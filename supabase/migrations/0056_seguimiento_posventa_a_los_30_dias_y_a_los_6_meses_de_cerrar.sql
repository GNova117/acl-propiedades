-- ─────────────────────────────────────────────
-- Seguimiento posventa (2026-09-28): a los 30 días y a los 6 meses de cerrar un
-- prospecto se le escribe para saber cómo va y pedir un comentario y una
-- recomendación (aviso en el panel; lo hecho se guarda aquí).
-- Los prospectos que YA estaban cerrados cuando se agrega esto quedan marcados
-- como atendidos, para no llenar el panel de pendientes viejos. Solo corre esa
-- marca la primera vez (si las columnas ya existen, no toca nada).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prospectos' and column_name = 'postsale_30_done_at'
  ) then
    alter table prospectos add column postsale_30_done_at timestamptz;
    alter table prospectos add column postsale_180_done_at timestamptz;
    update prospectos set postsale_30_done_at = now(), postsale_180_done_at = now() where stage = 'cerrado';
  end if;
end;
$$;

