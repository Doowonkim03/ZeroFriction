# AI Task Clinic

## Who uses it

Owner-operators of small and medium trade businesses within the construction industry, such as electricians, plumbers and carpenters, who have limited time or expertise to evaluate AI.

## What they can do

- Enter basic business information, including trade type, business size and key admin activities.
- Select a time-consuming business task they want to improve.
- Upload an example document related to that task.
- Receive 1–2 personalised AI use-case recommendations.
- See why each AI use case was recommended and its potential benefit.
- Select the AI use case they want to explore.
- Receive a simple action plan with a suggested approach and one clear first step.

## Data

Use the existing Supabase `task_assessments` table with these fields:

- id
- created_at
- trade_type
- business_size
- admin_pain_points
- task_type
- uploaded_file_ref
- identified_pain_points
- ai_use_case
- recommendation_reason
- potential_benefit
- relevance_ranking
- selected_use_case
- first_action

## Core flow

1. The user enters their trade type, business size and main admin pain points.
2. The user selects a time-consuming task such as quoting, invoicing, scheduling or customer communication.
3. The user uploads an example document related to the selected task.
4. The system analyses the business information and uploaded task.
5. If there is not enough information, ask only for the missing information.
6. Present the 1–2 most relevant AI use cases.
7. Explain why each recommendation is relevant and its potential benefit.
8. The user selects the AI use case they want to explore.
9. Generate a simple action plan with a suggested approach and one clear first step.
10. Save the assessment and recommendation to Supabase.

## Recommendation logic

- Consider the user's trade type, business size, admin pain points and selected task.
- Analyse the uploaded document together with the business information.
- Prioritise AI use cases that directly address the task or pain point.
- Return only the 1–2 most relevant recommendations.
- Explain why each recommendation was selected.
- Show the potential benefit of each recommendation.
- Do not claim exact time savings unless there is sufficient evidence.
- If there is insufficient information, ask only for the missing information instead of returning a generic recommendation.
- The final action plan must contain at least one practical first step.

## Must-haves

- Business profile input
- Task selection
- Example document upload
- Analysis of the submitted business/task information
- 1–2 personalised AI use-case recommendations
- Explanation of recommendation relevance and potential benefit
- Recommendation selection
- First-step action plan
- Save the assessment and recommendation to Supabase

## Out of scope for now

- Direct integrations with accounting, quoting or job-management software
- Automatically implementing the recommended AI solution
- Fully automated AI agents making business decisions for the owner
- Previous assessment or recommendation history
- Advanced analytics and reporting
- Production deployment or hosting

## Build Plan
1. Business details form and saving assessments to Supabase · Doowon
2. Document upload and storage in Supabase · Alex
3. AI agent to analyse business tasks and identify AI opportunities · Cashwin
4. Rank and explain the top 1–2 AI recommendations · Miki
5. Display personalised recommendations and first-step action plan · Diego
6. Human approval and saving selected recommendations · Jocelyn

Agent: Analyse uploaded business tasks, identify relevant AI opportunities, recommend the top 1-2 use cases and generate a practical first-step action plan.  Responsible: Cashwin
Check-ins: 24th October at 4PM, Microsoft Teams
Each person brings: Progress on assigned features, working GitHub branches, completed functionality, any blockers and next steps.

## Slices
Done:(Document upload and storage in Supabase, AI agent to analyse business tasks and identify AI opportunities), Rank and explain the top 1-2 AI recommendations.
Now: Slice 5
Next:

## Decisions
- [date]: [decision], because [reason]

## Slice 2 (Document upload and storage in Supabase)
  Story: As a trade business owner, I want to upload an example document such as a quote, invoice or job description so that the AI Task Clinic can analyse my actual business task and recommend relevant AI opportunities.
  Data: Reads the existing task assessment ID and uploaded document. Stores the file securely in Supabase Storage and saves its storage reference in task_assessments.uploaded_file_ref.
  Rule: Only accept PDF, DOCX and TXT files up to 10 MB. Keep uploaded documents private and accessible only through server-side operations.
  Done when:
  1. 1. A user can select and upload a supported document.
  2. 2. The document is successfully stored in Supabase Storage.
  3. 3. The uploaded file reference is saved against the correct task assessment.
  4. 4. The user receives a clear success or error message.
  5. 5. Existing assessment functionality continues to work.
  Not in this slice: AI document analysis, AI recommendations, action-plan generation and human approval.

## Slice 3 (AI agent to analyse business tasks and identify AI opportunities)
 Story: As a trade business owner, I want an AI agent to analyse my business information and uploaded document so that I can identify relevant AI opportunities without researching different tools myself.
  Data: Reads trade_type, business_size, admin_pain_points, task_type and uploaded_file_ref from Supabase. Saves the analysis to identified_pain_points.
  Rule: The agent must analyse the actual business information and document content. If essential information is missing, it should ask for clarification rather than invent details.
  Done when:
  1. The agent can access the submitted business information.
  2. The agent can analyse the uploaded document's content.
  3. The agent identifies relevant administrative pain points and potential AI opportunities.
  4. The analysis is saved to the correct Supabase assessment.
  5. Existing functionality continues working.
  Not in this slice: Recommendation ranking, results-page design, action-plan generation and human approval.

## Slice 4:(Rank and explain the top 1-2 AI recommendations.)
Story: As a trade business owner, I want to receive the most relevant AI recommendations based on my business needs so that I can understand which opportunities are worth exploring first.
  Data: Data it reads or changes Reads trade_type, business_size, admin_pain_points, task_type and identified_pain_points.  Saves recommendations to ai_use_case, recommendation_reason, potential_benefit and relevance_ranking in Supabase.
  Rule: Recommendations must be ranked based on relevance to the business problem, potential time savings, implementation effort and risk. Only the top 1–2 recommendations should be returned.
  Done when:
  1. The system uses the AI analysis from Slice 3.
  2. It generates and ranks the top 1–2 relevant AI use cases.
  3. Each recommendation explains why it was selected.
  4. Each recommendation describes its potential benefit.
  5. Recommendations are saved against the correct assessment in Supabase.
  6. Existing functionality continues working.
  Not in this slice: Results-page design, action-plan generation and human approval.

## Slice 5: Display personalised AI recommendations and first-step action plan.

  Story: As a trade business owner, I want to view personalised AI recommendations and select the one most relevant to my business so that I can understand its benefits and receive a clear, practical action plan.
  Data: Reads ai_use_case, recommendation_reason, potential_benefit and relevance_ranking from Supabase.  Uses the selected recommendation to generate and display a first-step action plan, including a suggested approach and practical next action.
  Rule: The action plan must be specific to the selected AI use case and the owner's business needs. It must contain at least one clear, achievable first step.
  Done when:
  1. The results page displays the top 1–2 ranked AI recommendations from Slice 4.
  2. Each recommendation shows its relevance and potential benefit.
  3. The user can select a recommendation to explore.
  4. A personalised first-step action plan is generated and displayed.
  5. The plan includes a suggested approach and one practical action.
  6. Existing functionality continues working.
  Not in this slice: Human approval, saving the final selection, automatically implementing AI solutions or integrating external business software.
