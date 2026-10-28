import { createClient } from "npm:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const base64 = (bytes: Uint8Array) => {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) result += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(result);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response({ ok: true });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceKey) return response({ error: "Server Supabase credentials are not configured." }, 500);
  if (!geminiKey) return response({ error: "AI analysis is not configured on the server." }, 500);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: "Request body must be valid JSON." }, 400); }
  const assessmentId = typeof body.assessment_id === "string" ? body.assessment_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId)) return response({ error: "Choose a valid saved assessment." }, 400);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: assessment, error } = await supabase.from("task_assessments")
    .select("id, trade_type, business_size, admin_pain_points, task_type, uploaded_file_ref")
    .eq("id", assessmentId).maybeSingle();
  if (error) return response({ error: "Could not load the selected assessment." }, 500);
  if (!assessment) return response({ error: "The selected assessment could not be found." }, 404);
  if (!assessment.uploaded_file_ref) return response({ error: "No document is linked to this assessment." }, 409);

  const match = assessment.uploaded_file_ref.match(/^task-assessment-documents\/[^/]+\/[^.]+\.(pdf|docx|txt)$/i);
  const extension = match?.[1]?.toLowerCase();
  const objectPath = assessment.uploaded_file_ref.replace(/^task-assessment-documents\//, "");
  if (!extension || !objectPath) return response({ error: "The selected assessment document reference is invalid." }, 400);

  const { data: file, error: downloadError } = await supabase.storage.from("task-assessment-documents").download(objectPath);
  if (downloadError || !file) return response({ error: "Could not download the uploaded document." }, 404);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) return response({ error: "The uploaded document exceeds 10 MB." }, 413);

  let documentPart: Record<string, unknown>;
  if (extension === "pdf") {
    documentPart = { inlineData: { mimeType: "application/pdf", data: base64(bytes) } };
  } else if (extension === "docx") {
    const mammoth = await import("npm:mammoth@1.9.1");
    const extracted = await mammoth.default.extractRawText({ buffer: Buffer.from(bytes) });
    documentPart = { text: extracted.value.slice(0, 200000) };
  } else {
    documentPart = { text: new TextDecoder().decode(bytes).slice(0, 200000) };
  }

  const prompt = [
    "Analyse this trade business and uploaded document.",
    "Identify evidence-grounded administrative pain points and practical potential AI opportunities relevant to the selected task.",
    "Do not invent facts. Return only the requested JSON.",
    `Trade type: ${assessment.trade_type ?? ""}\nBusiness size: ${assessment.business_size ?? ""}\nMain admin pain points: ${assessment.admin_pain_points ?? ""}\nSelected task: ${assessment.task_type ?? ""}`,
    typeof body.clarification_answer === "string" && body.clarification_answer.trim() ? `Owner clarification: ${body.clarification_answer.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  const schema = {
    type: "OBJECT", properties: {
      status: { type: "STRING", enum: ["analysed", "needs_clarification"] }, summary: { type: "STRING" },
      pain_points: { type: "ARRAY", items: { type: "OBJECT", properties: { pain_point: { type: "STRING" }, evidence: { type: "STRING" } }, required: ["pain_point", "evidence"] } },
      potential_ai_opportunities: { type: "ARRAY", items: { type: "OBJECT", properties: { opportunity: { type: "STRING" }, task_supported: { type: "STRING" }, evidence: { type: "STRING" } }, required: ["opportunity", "task_supported", "evidence"] } },
      clarification_questions: { type: "ARRAY", items: { type: "STRING" } },
    }, required: ["status", "summary", "pain_points", "potential_ai_opportunities", "clarification_questions"]
  };

  const modelNames = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
  let gemini: Response | undefined;
  let providerError = "";
  for (const modelName of modelNames) {
    try {
      gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are an evidence-grounded analyst for trade businesses. Follow the JSON schema exactly." }] },
          contents: [{ role: "user", parts: [{ text: prompt }, documentPart] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
        }),
      });
      if (gemini.ok) break;
      providerError = await gemini.text();
      if (![429, 503].includes(gemini.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(error);
    }
  }
  if (!gemini?.ok) {
    return response({ error: "The AI analysis service could not complete the request.", provider_status: gemini.status, provider_message: providerError.slice(0, 2000) }, 502);
  }
  try {
    const result = await gemini.json();
    const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("");
    const analysis = JSON.parse(text);
    await supabase.from("task_assessments").update({ identified_pain_points: JSON.stringify(analysis) }).eq("id", assessment.id);
    return response({ assessment_id: assessment.id, analysis, needs_clarification: analysis.status === "needs_clarification" });
  } catch (error) {
    console.error(error);
    return response({ error: "The AI returned an invalid analysis. Please try again." }, 502);
  }
});
