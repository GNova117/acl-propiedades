-- ─────────────────────────────────────────────
-- Chatbot público (2026-10-15)
-- /api/chat.js (función de Vercel) atiende el chat del sitio público (sin
-- login) con Claude Haiku 5.5 — ver server/chatbot.js. Un visitante nunca
-- tiene sesión de Supabase, así que esta tabla (como portal_upload_attempts)
-- solo la toca la función con SUPABASE_SERVICE_ROLE_KEY: cuenta mensajes por
-- sesión de chat (abuso de una sola persona) Y en total (gasto del día),
-- ambos con la misma fila — session_id es un UUID que genera el navegador
-- por conversación, no identifica a la persona.
-- RLS sin políticas = nadie con anon/authenticated puede leer ni escribir
-- aquí directo; la service role siempre pasa por encima de RLS.
-- ─────────────────────────────────────────────

create table if not exists chat_rate_limits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_rate_limits_session on chat_rate_limits(session_id, created_at desc);
create index if not exists idx_chat_rate_limits_created on chat_rate_limits(created_at desc);

alter table chat_rate_limits enable row level security;

