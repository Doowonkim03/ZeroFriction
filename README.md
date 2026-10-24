# ZeroFriction
INFS3605 Group Project
Cashwin - Project Lead
Doowon - Member
Alex(Zhehao) - Member
Jocelyn(Jialin) - Member
Diego(Shengze Xue) - Member

## Private assessment document uploads

Apply the Supabase migrations and deploy the `assessments` Edge Function to create the private `task-assessment-documents` bucket and enable document uploads. The browser uses only the public anon key; keep `SUPABASE_SERVICE_ROLE_KEY` configured as an Edge Function secret and never expose it to the client. The function accepts PDF, DOCX and TXT files up to 10 MB and stores the private storage reference in `task_assessments.uploaded_file_ref` without returning the path to the browser.

Business-task analysis uses Google Gemini from the server. Add `GEMINI_API_KEY` as a Supabase Edge Function secret before deploying. The browser warns users that assessment details and document content are sent to Gemini for analysis. DOCX text extraction uses Mammoth in the Edge Function; documents whose extracted text exceeds 200,000 characters prompt the user to provide a shorter relevant copy rather than silently truncating content.

AI recommendation ranking uses the saved analysis and the same server-side Gemini secret. Apply the `20261024010000_create_assessment_recommendations.sql` migration before deploying the updated function. It stores up to two ranked recommendations in a private-by-RLS linked table and mirrors the top recommendation into the existing scalar recommendation columns on `task_assessments`.
