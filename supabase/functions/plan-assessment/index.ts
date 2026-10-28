import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

const planSchema = {
  type: "OBJECT",
  properties: {
    suggested_approach: { type: "STRING" },
    first_action: { type: "STRING" },
  },
  required: ["suggested_approach", "first_action"],
};

function fallbackPlan(useCase: string, assessment: any, recommendation: any) {
  const business = [assessment.trade_type, assessment.task_type].filter(Boolean).join(" ");
  const painPoint = assessment.admin_pain_points || recommendation.recommendation_reason || "the current manual process";
  const lowerCase = useCase.toLowerCase();
  let approach = "Start with one small, low-risk trial using recent examples from normal jobs, and compare the time and quality with the current manual process before changing how the whole business works.";
  let action = "Choose one recent job or task that is representative of the current work, write down the current steps and time taken, and create a single test example for this use case.";

  if (/quote|estimate|invoice/.test(lowerCase)) {
    approach = `Pilot AI-assisted drafting for quotes or estimates in ${business || "this trade business"}, while keeping the owner responsible for prices, scope and final approval.`;
    action = "Select three recently completed jobs, gather their standard scope and pricing details, and prepare one draft quote for each using the same template the business normally sends.";
  } else if (/description|stock|material|inventory|item/.test(lowerCase)) {
    approach = `Use AI to draft standard descriptions or item labels for the most common items in ${business || "the business"}, then review them against existing job records before reuse.`;
    action = "Create a list of the five items or materials used most often in recent jobs and write or generate one approved standard description for each.";
  } else if (/schedule|scheduling|appointment|booking|job allocation/.test(lowerCase)) {
    approach = `Test AI-assisted scheduling on a limited set of upcoming jobs, with the owner retaining final control over travel time, dependencies and customer commitments.`;
    action = "List the next five scheduled jobs with duration, location and required materials, then ask the owner or scheduler to create one improved draft schedule to review.";
  } else if (/lead|enquir|customer|email|message/.test(lowerCase)) {
    approach = "Draft a small library of professional customer messages for common enquiries and compare them with the messages the owner currently sends.";
    action = "Choose one common customer enquiry, draft a clear response covering the next step and timing, and review it against three recent enquiries before using it for new messages.";
  } else if (/document|report|job note|compliance/.test(lowerCase)) {
    approach = "Use AI to create a first draft from information already captured after a job, while keeping required safety and compliance decisions under owner review.";
    action = "Take one recently completed job, collect its notes and required fields, and produce a single draft job record or report for owner review.";
  }

  approach += ` This directly addresses ${painPoint}.`;
  return { suggested_approach: approach, first_action: action };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceKey) return json({ error: "Server Supabase credentials are not configured." }, 500);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const assessmentId = typeof body.assessment_id === "string" ? body.assessment_id : "";
  const selectedUseCase = typeof body.selected_use_case === "string" ? body.selected_use_case.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId)) return json({ error: "Choose a valid saved assessment." }, 400);
  if (!selectedUseCase) return json({ error: "Choose a recommendation to explore." }, 400);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [{ data: assessment, error: assessmentError }, { data: recommendations, error: recommendationsError }] = await Promise.all([
    supabase.from("task_assessments").select("id, trade_type, business_size, admin_pain_points, task_type").eq("id", assessmentId).maybeSingle(),
    supabase.from("task_assessment_recommendations").select("ai_use_case, recommendation_reason, potential_benefit, relevance_ranking").eq("assessment_id", assessmentId).order("relevance_ranking", { ascending: true }),
  ]);
  if (assessmentError || !assessment) return json({ error: "Could not load the selected assessment." }, 404);
  if (recommendationsError || !recommendations?.length) return json({ error: "No saved recommendations are available for this assessment." }, 409);
  const selected = recommendations.find((item) => item.ai_use_case === selectedUseCase);
  if (!selected) return json({ error: "The selected recommendation is not saved for this assessment." }, 400);

  const fallback = fallbackPlan(selectedUseCase, assessment, selected);
  if (!geminiKey) return json({ plan: fallback });

  const prompt = [
    "Create a practical first-step action plan for this specific trade-business recommendation.",
    "Use only the supplied context. Do not invent tools, costs, integrations or compliance claims.",
    `Business context: ${JSON.stringify(assessment)}`,
    `Selected recommendation: ${JSON.stringify(selected)}`,
    "Suggested approach: one realistic low-risk trial for the selected use case.",
    "First action: one concrete action achievable within a normal working day.",
  ].join("\n\n");

  for (const model of ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite-preview"]) {
    try {
      const provider = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are a practical AI adoption coach for construction trade businesses. Return only the JSON plan requested." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: planSchema, temperature: 0.2 },
        }),
      });
      if (provider.ok) {
        const result = await provider.json();
        const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("");
        const plan = JSON.parse(text);
        const approach = typeof plan.suggested_approach === "string" ? plan.suggested_approach.trim() : "";
        const action = typeof plan.first_action === "string" ? plan.first_action.trim() : "";
        const placeholder = /^(one realistic low-risk trial for the selected use case\.?|one concrete action achievable within a normal working day\.?)/i;
        if (approach.length >= 40 && action.length >= 40 && !placeholder.test(approach) && !placeholder.test(action)) {
          return json({ plan: { suggested_approach: approach, first_action: action } });
        }
      } else if (![429, 503].includes(provider.status)) {
        break;
      }
    } catch (error) { console.error(`Action-plan model ${model} failed:`, error); }
  }

  return json({ plan: fallback });
});
