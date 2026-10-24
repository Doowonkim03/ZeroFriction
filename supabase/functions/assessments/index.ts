import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const REQUIRED_CREATE_FIELDS = [
  "trade_type",
  "business_size",
  "task_type",
  "admin_pain_points",
] as const;

const ALLOWED_OPTIONAL_UPDATE_FIELDS = [
  "uploaded_file_ref",
  "identified_pain_points",
  "ai_use_case",
  "recommendation_reason",
  "potential_benefit",
  "relevance_ranking",
  "selected_use_case",
  "first_action",
] as const;

const ALL_ASSESSMENT_FIELDS = [
  "id",
  "created_at",
  "trade_type",
  "business_size",
  "admin_pain_points",
  "task_type",
  "uploaded_file_ref",
  "identified_pain_points",
  "ai_use_case",
  "recommendation_reason",
  "potential_benefit",
  "relevance_ranking",
  "selected_use_case",
  "first_action",
] as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseOptionalTextField(value: unknown, fieldName: string, maxLength?: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (maxLength && trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds the allowed length.`);
  }
  return trimmed;
}

function parseOptionalIntField(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} must be a whole number greater than or equal to 1.`);
  }
  return parsed;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!( ["GET", "POST", "PATCH"].includes(request.method))) {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server Supabase credentials are not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (request.method === "GET") {
    const { data, error } = await supabase
      .from("task_assessments")
      .select(ALL_ASSESSMENT_FIELDS.join(", "))
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("Load failed:", error.message);
      return jsonResponse({ error: "Could not load assessments." }, 500);
    }
    return jsonResponse(data);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400);
  }

  if (request.method === "PATCH") {
    const assessmentId = body.id;
    if (!isValidUuid(assessmentId)) {
      return jsonResponse({ error: "A valid assessment id is required for update operations." }, 400);
    }

    const unknownKeys = Object.keys(body).filter((key) => key !== "id" && !ALLOWED_OPTIONAL_UPDATE_FIELDS.includes(key as (typeof ALLOWED_OPTIONAL_UPDATE_FIELDS)[number]));
    if (unknownKeys.length > 0) {
      return jsonResponse({ error: "Only approved optional assessment fields may be updated." }, 400);
    }

    const updatePayload: Record<string, string | number> = {};

    for (const field of ALLOWED_OPTIONAL_UPDATE_FIELDS) {
      const value = body[field];
      if (value === undefined || value === null) continue;

      if (field === "relevance_ranking") {
        const ranking = parseOptionalIntField(value, field);
        if (ranking !== undefined) updatePayload[field] = ranking;
        continue;
      }

      const textValue = parseOptionalTextField(value, field, 2000);
      if (textValue !== undefined) updatePayload[field] = textValue;
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonResponse({ error: "No valid optional fields were supplied for update." }, 400);
    }

    const { data, error } = await supabase
      .from("task_assessments")
      .update(updatePayload)
      .eq("id", assessmentId)
      .select(ALL_ASSESSMENT_FIELDS.join(", "))
      .single();

    if (error) {
      console.error("Update failed:", error.message);
      return jsonResponse({ error: "Could not update the assessment." }, 500);
    }

    return jsonResponse(data, 200);
  }

  const tradeType = typeof body.trade_type === "string" ? body.trade_type.trim() : "";
  const taskType = typeof body.task_type === "string" ? body.task_type.trim() : "";
  // The page sends "bottleneck"; "admin_pain_points" (the column name) is also accepted
  const bottleneckRaw = body.bottleneck ?? body.admin_pain_points;
  const bottleneck = typeof bottleneckRaw === "string" ? bottleneckRaw.trim() : "";
  const sizeIsValidType = typeof body.business_size === "number" ||
    (typeof body.business_size === "string" && body.business_size.trim() !== "");
  const businessSize = sizeIsValidType ? Number(body.business_size) : NaN;

  if (!tradeType || tradeType.length > 100 || !taskType || taskType.length > 100 ||
      !bottleneck || bottleneck.length > 500 || !Number.isInteger(businessSize) ||
      businessSize < 1 || businessSize > 200) {
    return jsonResponse({ error: "Complete all fields. Business size must be a whole number from 1 to 200." }, 400);
  }

  const { data, error } = await supabase
    .from("task_assessments")
    .insert({
      trade_type: tradeType,
      business_size: businessSize,
      task_type: taskType,
      admin_pain_points: bottleneck,
      identified_pain_points: bottleneck,
    })
    .select(ALL_ASSESSMENT_FIELDS.join(", "))
    .single();

  if (error) {
    console.error("Save failed:", error.message);
    return jsonResponse({ error: "Could not save the assessment." }, 500);
  }

  return jsonResponse(data, 201);
});