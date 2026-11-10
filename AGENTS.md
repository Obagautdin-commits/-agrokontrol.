# Codex instructions — AgroKontrol
- Reply to the project owner in clear Russian. Avoid vague claims of completion.
- Keep the React/Vite/Supabase architecture unless change is justified.
- Never expose Supabase service_role, secret API keys or database passwords in the browser or GitHub.
- Keep RLS; test both admin and agronomist policies for financial tables.
- Business rules: one monthly charge per client; rate snapshot; weekly installments; never invent financial records.
- Check `npm run build` after code changes and report actual results.
- Keep mobile responsive behavior, finance dashboard, visit calendar, and Cyrillic labels.
- Prefer small, reviewable changes and migrations, no destructive resets of live data.
