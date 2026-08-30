# Word Practice AI

Word Practice AI is a student-only module inside the existing Student Portal. Its GitHub Pages-safe route is `student.html#ai-practice`; it reuses the shared Student Portal shell, themes and hash navigation.

The page embeds the already deployed standalone application at `https://bot-1788103967-7444-sasha25.bothost.tech` in a responsive iframe. A visible `Open AI Practice` link opens the same app in a new tab when embedding is unavailable.

Teacher Dashboard does not call the practice API directly, store AI requests or contain Kie.ai/Gemini credentials. Learner type, CEFR selection, validation and generation stay inside the standalone application. No Firestore rule, schema or admin flow changes are required.
