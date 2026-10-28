import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const schema = {
  type: "OBJECT",
  properties: { candidates: { type: "ARRAY", items: { type: "OBJECT", properties: {
    ai_use_case: { type: "STRING" }, recommendation_reason: { type: "STRING" }, potential_benefit: { type: "STRING" },
    relevance_score: { type: "INTEGER", minimum: 1, maximum: 5 }, time_savings_score: { type: "INTEGER", minimum: 1, maximum: 5 },
    implementation_ease_score: { type: "INTEGER", minimum: 1, maximum: 5 }, risk_score: { type: "INTEGER", minimum: 1, maximum: 5 }
  }, required: ["ai_use_case", "recommendation_reason", "potential_benefit", "relevance_score", "time_savings_score", "implementation_ease_score", "risk_score"] } } },
  required: ["candidates"]
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceKey) return json({ error: "Server Supabase credentials are not configured." }, 500);
  if (!geminiKey) return json({ error: "AI recommendations are not configured on the server." }, 500);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const assessmentId = typeof body.assessment_id === "string" ? body.assessment_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId)) return json({ error: "Choose a valid saved assessment." }, 400);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: assessment, error } = await supabase.from("task_assessments")
    .select("id, trade_type, business_size, admin_pain_points, task_type, identified_pain_points")
    .eq("id", assessmentId).maybeSingle();
  if (error || !assessment) return json({ error: error ? "Could not load the selected assessment." : "The selected assessment could not be found." }, error ? 500 : 404);

  let analysis: any;
  try { analysis = JSON.parse(assessment.identified_pain_points ?? ""); } catch { return json({ error: "Analyse this assessment before generating recommendations." }, 409); }
  if (analysis.status !== "analysed" || !Array.isArray(analysis.potential_ai_opportunities) || !analysis.potential_ai_opportunities.length) {
    return json({ error: "This assessment needs more information before recommendations can be generated." }, 409);
  }

  const prompt = [
    "Rank practical AI use cases for this construction trade business.",
    "Use only the supplied analysis and do not invent evidence.",
    "Return at most 5 candidates; the application will select the best 2.",
    `Assessment: ${JSON.stringify({ trade_type: assessment.trade_type, business_size: assessment.business_size, admin_pain_points: assessment.admin_pain_points, task_type: assessment.task_type })}`,
    `Analysis: ${JSON.stringify(analysis)}`,
  ].join("\n\n");

  let provider: Response | undefined;
  let providerError = "";
  for (const model of ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite-preview"]) {
    try {
      provider = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Recommend evidence-grounded AI opportunities for a small trade business. Follow the JSON schema exactly." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
        }),
      });
      if (provider.ok) break;
      providerError = await provider.text();
      if (![429, 503].includes(provider.status)) break;
    } catch (error) { console.error(error); }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  if (!provider?.ok) return json({ error: "The AI recommendation service could not complete the request.", provider_status: provider?.status ?? 502, provider_message: providerError.slice(0, 2000) }, 502);

  try {
    const result = await provider.json();
    const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("");
    const candidates = JSON.parse(text).candidates ?? [];
    const valid = candidates.filter((candidate: any) => candidate?.ai_use_case?.trim() && candidate?.recommendation_reason?.trim() && candidate?.potential_benefit?.trim());
    const recommendations = valid.map((candidate: any) => ({
      ...candidate,
      weightedScore: candidate.relevance_score * 0.45 + candidate.time_savings_score * 0.25 + candidate.implementation_ease_score * 0.15 + (6 - candidate.risk_score) * 0.15,
    })).sort((a: any, b: any) => b.weightedScore - a.weightedScore).slice(0, 2).map((candidate: any, index: number) => ({
      relevance_ranking: index + 1,
      ai_use_case: candidate.ai_use_case.trim(),
      recommendation_reason: candidate.recommendation_reason.trim(),
      potential_benefit: candidate.potential_benefit.trim(),
      ranking_details: { relevance: candidate.relevance_score, potential_time_savings: candidate.time_savings_score, implementation_ease: candidate.implementation_ease_score, risk: candidate.risk_score, weighted_score: Number(candidate.weightedScore.toFixed(2)) }
    }));
    if (!recommendations.length) throw new Error("No recommendations returned");

    const { error: saveError } = await supabase.rpc("save_task_assessment_recommendations", { p_assessment_id: assessment.id, p_recommendations: recommendations });
    if (saveError) throw saveError;
    return json({ assessment_id: assessment.id, recommendations });
  } catch (error: any) {
    console.error("Recommendation save or parsing failed:", error);
    return json({ error: "The recommendations were generated but could not be saved." }, 500);
  }
});
