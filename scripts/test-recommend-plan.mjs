import { readFile } from "node:fs/promises";

const coachHtml = await readFile(new URL("../ZeroFriction AI Coach.html", import.meta.url), "utf8");
const dataMatch = coachHtml.match(/window\.ZF_DATA\s*=\s*(\{.*?\});/s);
if (!dataMatch) throw new Error("Could not read the use-case catalog from the coach page.");
const coachData = JSON.parse(dataMatch[1]);
const configMatch = coachHtml.match(/window\.ZF_SUPABASE\s*=\s*\{\s*url:'([^']+)',\s*anonKey:'([^']+)'\s*\};/);
if (!configMatch) throw new Error("Could not read the Supabase project settings from the coach page.");
const supabaseConfig = { url: configMatch[1], anonKey: configMatch[2] };
const catalog = Object.entries(coachData.use_cases).map(([id, item]) => ({
  id,
  title: item.title,
  description: item.description,
}));

const samples = [
  {
    name: "Sole-trader plumber — invoicing, new to AI",
    context: {
      trade: "Plumbing",
      team_size: 1,
      selected_tasks: ["Invoicing and follow-up", "Job notes and paperwork"],
      task_priorities: ["Invoicing and follow-up", "Job notes and paperwork"],
      slowdowns_by_task: {
        "Invoicing and follow-up": ["Finding completed job details", "Re-entering details across tools"],
        "Job notes and paperwork": ["Writing notes after the job"],
      },
      time_cost_per_week: "3 to 6 hours",
      work_timing: ["Evenings"],
      work_done_by: "Me",
      current_tools: ["Spreadsheets", "Email and phone"],
      ai_experience: "Never",
      ai_worries: ["Accuracy of the answers"],
      recommendation_review_style: "I want to review every AI draft",
    },
  },
  {
    name: "Five-person electrician — quotes, evening work",
    context: {
      trade: "Electrical",
      team_size: 5,
      selected_tasks: ["Preparing quotes", "Scheduling jobs"],
      task_priorities: ["Preparing quotes", "Scheduling jobs"],
      slowdowns_by_task: {
        "Preparing quotes": ["Writing up the quote", "Collecting job details"],
        "Scheduling jobs": ["Passing details to the team"],
      },
      time_cost_per_week: "1 to 3 hours",
      work_timing: ["Evenings"],
      work_done_by: "Office admin or staff",
      current_tools: ["Job management software"],
      ai_experience: "Tried it once or twice",
      ai_worries: ["Time to learn"],
      recommendation_review_style: "My team can help test a small pilot",
    },
  },
  {
    name: "Carpenter — customer enquiries, some AI experience",
    context: {
      trade: "Carpentry",
      team_size: 3,
      selected_tasks: ["Customer enquiries", "Preparing quotes"],
      task_priorities: ["Customer enquiries", "Preparing quotes"],
      slowdowns_by_task: {
        "Customer enquiries": ["Collecting missing job details", "Replying while on site"],
        "Preparing quotes": ["Following up on sent quotes"],
      },
      time_cost_per_week: "Under 1 hour",
      work_timing: ["During the workday"],
      work_done_by: "Me",
      current_tools: ["Email and phone"],
      ai_experience: "Use it sometimes",
      ai_worries: ["Losing the personal touch"],
      recommendation_review_style: "I am comfortable testing AI tools",
    },
  },
  {
    name: "Builder — compliance paperwork, privacy concern",
    context: {
      trade: "General building",
      team_size: 8,
      selected_tasks: ["Compliance paperwork", "Job notes and paperwork"],
      task_priorities: ["Compliance paperwork", "Job notes and paperwork"],
      slowdowns_by_task: {
        "Compliance paperwork": ["Finding licences and certificates", "Keeping records up to date"],
        "Job notes and paperwork": ["Organising photos and documents"],
      },
      time_cost_per_week: "More than 6 hours",
      work_timing: ["Weekends"],
      work_done_by: "A bookkeeper or outside provider",
      current_tools: ["Spreadsheets", "Email and phone"],
      ai_experience: "Tried it once or twice",
      ai_worries: ["Customer data and privacy"],
      recommendation_review_style: "I want to review every AI draft",
    },
  },
];

const supabaseUrl = supabaseConfig.url?.replace(/\/+$/, "");
const anonKey = supabaseConfig.anonKey;
const siteOrigin = process.env.SITE_ORIGIN;
if (!supabaseUrl || !anonKey) throw new Error("The coach page has no Supabase project settings.");
if (!siteOrigin) throw new Error("Set SITE_ORIGIN to an origin allowed by the recommend-plan function.");

let failures = 0;
for (const sample of samples) {
  process.stdout.write(`\n### ${sample.name}\n`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/recommend-plan`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
        Origin: siteOrigin,
      },
      body: JSON.stringify({ context: sample.context, catalog }),
      signal: AbortSignal.timeout(20000),
    });
    process.stdout.write(`HTTP ${response.status}\n`);
    const result = await response.json().catch(() => ({ error: "Response was not JSON." }));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!response.ok) failures++;
  } catch (error) {
    failures++;
    process.stdout.write(`${JSON.stringify({ httpStatus: null, error: error.message }, null, 2)}\n`);
  }
}

if (failures) process.exitCode = 1;
