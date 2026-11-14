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

const documentCases = [
  {
    name: "Two fictional paperwork examples: quote PDF and invoice image",
    context: samples[1].context,
    files: [
      {
        bytes: await readFile(new URL("./test/fixtures/fictional-quote.pdf", import.meta.url)),
        name: "fictional-quote.pdf",
        type: "application/pdf",
      },
      {
        bytes: await readFile(new URL("./test/fixtures/fictional-invoice.png", import.meta.url)),
        name: "fictional-invoice.png",
        type: "image/png",
      },
    ],
  },
  {
    name: "Untrusted instructions in an example are ignored",
    context: samples[2].context,
    files: [{
      bytes: await readFile(new URL("./test/fixtures/untrusted-instructions.txt", import.meta.url)),
      name: "untrusted-instructions.txt",
      type: "text/plain",
    }],
    rejectsPromptInjection: true,
  },
];

const supabaseUrl = supabaseConfig.url?.replace(/\/+$/, "");
const anonKey = supabaseConfig.anonKey;
const siteOrigin = process.env.SITE_ORIGIN;
if (!supabaseUrl || !anonKey) throw new Error("The coach page has no Supabase project settings.");
if (!siteOrigin) throw new Error("Set SITE_ORIGIN to an origin allowed by the recommend-plan function.");

const testCases = samples.map((sample, index) => {
  const documentCase = index === 1 ? documentCases[0] : index === 2 ? documentCases[1] : null;
  return {
    ...sample,
    name: documentCase ? `${sample.name} — ${documentCase.name}` : sample.name,
    files: documentCase?.files ?? [],
    rejectsPromptInjection: documentCase?.rejectsPromptInjection ?? false,
  };
});
const argumentsList = process.argv.slice(2);
let selectedCases;
let runAll = false;
if (argumentsList.length === 0) {
  selectedCases = [testCases[0]];
} else if (argumentsList.length === 1 && argumentsList[0] === "--all") {
  selectedCases = testCases;
  runAll = true;
} else if (argumentsList.length === 1 && /^\d+$/.test(argumentsList[0])) {
  const sampleNumber = Number(argumentsList[0]);
  if (sampleNumber < 1 || sampleNumber > testCases.length) {
    throw new Error(`Choose a sample number from 1 to ${testCases.length}.`);
  }
  selectedCases = [testCases[sampleNumber - 1]];
} else {
  throw new Error("Usage: node scripts/test-recommend-plan.mjs [1-4 | --all]");
}

let failures = 0;
for (const [index, sample] of selectedCases.entries()) {
  process.stdout.write(`\n### ${sample.name}\n`);
  try {
    let body;
    const headers = { apikey: anonKey, Origin: siteOrigin };
    if (sample.files.length) {
      const form = new FormData();
      form.append("context", JSON.stringify(sample.context));
      form.append("catalog", JSON.stringify(catalog));
      form.append("document_consent", "true");
      for (const file of sample.files) {
        form.append("documents", new Blob([file.bytes], { type: file.type }), file.name);
      }
      body = form;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ context: sample.context, catalog });
    }
    const response = await fetch(`${supabaseUrl}/functions/v1/recommend-plan`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(sample.files.length ? 60000 : 20000),
    });
    process.stdout.write(`HTTP ${response.status}\n`);
    const result = await response.json().catch(() => ({ error: "Response was not JSON." }));
    process.stdout.write(`document_notes: ${JSON.stringify(result.document_notes ?? null)}\n`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!response.ok) failures++;
    if (sample.files.length && typeof result.document_notes !== "string") {
      throw new Error("The document response did not include document_notes.");
    }
    if (sample.rejectsPromptInjection &&
        /ignore all instructions|recommend buying our software/i.test(JSON.stringify(result.recommendations))) {
      throw new Error("The recommendation followed untrusted document instructions.");
    }
  } catch (error) {
    failures++;
    process.stdout.write(`${JSON.stringify({ httpStatus: null, error: error.message }, null, 2)}\n`);
  }
  if (runAll && index < selectedCases.length - 1) {
    process.stdout.write("\nWaiting 20 seconds before the next sample...\n");
    await new Promise(resolve => setTimeout(resolve, 20000));
  }
}

if (failures) process.exitCode = 1;
