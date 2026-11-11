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
- Receive a simple action plan with a suggested approach and three practical first-test steps.

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
- recommendation_plan
- recommendation_source (`ai` or `fallback`)

## Core flow

1. The user enters their trade type, business size and main admin pain points.
2. The user selects a time-consuming task such as quoting, invoicing, scheduling or customer communication.
3. The user uploads an example document related to the selected task.
4. The system analyses the business information and uploaded task.
5. If there is not enough information, ask only for the missing information.
6. Present the 1–2 most relevant AI use cases.
7. Explain why each recommendation is relevant and its potential benefit.
8. The user selects the AI use case they want to explore.
9. Generate a simple action plan with a suggested approach and three practical first-test steps.
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
- The final action plan must contain exactly three practical first-test steps.

## Must-haves

- Business profile input
- Task selection
- Example document upload
- Analysis of the submitted business/task information
- 1–2 personalised AI use-case recommendations
- Explanation of recommendation relevance and potential benefit
- Recommendation selection
- Three-step first-test action plan
- Save the assessment and recommendation to Supabase

## Out of scope for now

- Direct integrations with accounting, quoting or job-management software
- Automatically implementing the recommended AI solution
- Fully automated AI agents making business decisions for the owner
- Previous assessment or recommendation history
- Advanced analytics and reporting
- Production deployment or hosting
