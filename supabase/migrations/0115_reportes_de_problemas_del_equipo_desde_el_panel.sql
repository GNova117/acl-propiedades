
-- ─────────────────────────────────────────────
-- Reportes de problemas del equipo desde el panel (2026-11-18)
-- (Explica aquí qué cambia y por qué.)
-- (bloque re-ejecutable: usa «if not exists», «create or replace», «drop policy if exists»…)
-- ─────────────────────────────────────────────

-- Las personas del equipo con sesión pueden avisar de un problema que notaron (algo que no sale bien, un dato raro, un botón
-- que no hace lo que debe) con el botón «Reportar un problema» del panel. El reporte se guarda en la MISMA tabla que los
-- errores del navegador (client_errors) para verse juntos en /admin/errores, pero con origen «usuario» y la etiqueta de QUIÉN lo
-- mandó (reported_by = su correo, tomado de la sesión: no lo escribe la persona). Cada reporte es independiente (no se agrupa) y
-- entra al mismo aviso por correo a los administradores (errores-aviso). Solo el personal con sesión puede mandarlos: máximo
-- 10 por hora por persona. No cambia nada de lo anterior.
-- (bloque re-ejecutable)

alter table client_errors add column if not exists reported_by text;

create or replace function report_user_problem(
  p_message text,
  p_url text default null,
  p_user_agent text default null,
  p_release text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  who text := auth.email();
  msg text := left(trim(coalesce(p_message, '')), 1000);
  recent int;
begin
  if who is null then
    raise exception 'Inicia sesión para reportar un problema' using errcode = '42501';
  end if;
  if length(msg) < 10 then
    raise exception 'Cuéntanos un poco más: escribe al menos 10 caracteres' using errcode = '22023';
  end if;

  select count(*) into recent from client_errors
   where source = 'usuario' and reported_by = who and first_seen > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'Ya mandaste varios reportes seguidos. Inténtalo de nuevo en un rato.' using errcode = '54429';
  end if;

  insert into client_errors (fingerprint, message, source, url, user_agent, release, reported_by)
  values (
    substr(md5(random()::text || clock_timestamp()::text || who), 1, 8),
    msg,
    'usuario',
    left(p_url, 300),
    left(p_user_agent, 300),
    left(p_release, 40),
    who
  )
  on conflict (fingerprint) do nothing;
end;
$$;

revoke all on function report_user_problem(text, text, text, text) from public, anon;
grant execute on function report_user_problem(text, text, text, text) to authenticated;
