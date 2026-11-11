import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(["GET", "POST"].includes(request.method))) {
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
      .select("id, created_at, trade_type, business_size, task_type, admin_pain_points")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      // Logged on the server only, so it shows in the function's Logs tab
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
  // Guard against bodies like null, a number or an array
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400);
  }

  const tradeType = typeof body.trade_type === "string" ? body.trade_type.trim() : "";
  const taskType = typeof body.task_type === "string" ? body.task_type.trim() : "";
  // The page sends "bottleneck"; "admin_pain_points" (the column name) is also accepted
  const bottleneckRaw = body.bottleneck ?? body.admin_pain_points;
  const bottleneck = typeof bottleneckRaw === "string" ? bottleneckRaw.trim() : "";
  const context = body.context;
  const recommendationPlan = body.recommendation_plan;
  const recommendationSource = body.recommendation_source;
  const hasRecommendationPlan = recommendationPlan !== undefined;
  const hasRecommendationSource = recommendationSource !== undefined;
  let recommendationPlanSize = 0;
  try {
    recommendationPlanSize = hasRecommendationPlan ? JSON.stringify(recommendationPlan).length : 0;
  } catch {
    recommendationPlanSize = Number.MAX_SAFE_INTEGER;
  }
  const sizeIsValidType = typeof body.business_size === "number" ||
    (typeof body.business_size === "string" && body.business_size.trim() !== "");
  const businessSize = sizeIsValidType ? Number(body.business_size) : NaN;

  if (!tradeType || tradeType.length > 100 || !taskType || taskType.length > 500 ||
      !bottleneck || bottleneck.length > 1500 ||
      (context !== undefined && (typeof context !== "object" || context === null || Array.isArray(context))) ||
      hasRecommendationPlan !== hasRecommendationSource ||
      (hasRecommendationPlan &&
        (typeof recommendationPlan !== "object" || recommendationPlan === null ||
          Array.isArray(recommendationPlan) || recommendationPlanSize > 20000 ||
          !["ai", "fallback"].includes(String(recommendationSource)))) ||
      !Number.isInteger(businessSize) ||
      businessSize < 1 || businessSize > 200) {
    return jsonResponse({ error: "Complete all fields. Business size must be a whole number from 1 to 200." }, 400);
  }

  const originalFields = {
    trade_type: tradeType,
    business_size: businessSize,
    task_type: taskType,
    admin_pain_points: bottleneck,
    identified_pain_points: bottleneck,
    ...(hasRecommendationPlan
      ? {
        recommendation_plan: recommendationPlan,
        recommendation_source: recommendationSource,
      }
      : {}),
  };
  let { data, error } = await supabase
    .from("task_assessments")
    .insert(context === undefined ? originalFields : { ...originalFields, context })
    .select("id, created_at, trade_type, business_size, task_type, admin_pain_points, recommendation_plan, recommendation_source")
    .single();
  if (error) {
    if (context !== undefined) {
      console.warn("Save with context failed; retrying without context:", error.message);
      ({ data, error } = await supabase
        .from("task_assessments")
        .insert(originalFields)
        .select("id, created_at, trade_type, business_size, task_type, admin_pain_points, recommendation_plan, recommendation_source")
        .single());
    }
    if (error) {
      console.error("Save failed:", error.message);
      return jsonResponse({ error: "Could not save the assessment." }, 500);
    }
  }
  return jsonResponse(data, 201);
});