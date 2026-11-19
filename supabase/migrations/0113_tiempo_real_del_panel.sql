-- ─────────────────────────────────────────────
-- Tiempo real del panel (2026-11-18)
-- Mensajes de contacto y prospectos nuevos aparecen en el panel al instante, sin recargar ni cambiar de pantalla
-- (Supabase Realtime, solo a las personas con sesión; las políticas de lectura de cada tabla siguen mandando: quien no puede
-- leer una fila tampoco recibe su aviso). Solo hay que agregar las tablas a la publicación «supabase_realtime».
-- Es lo único que hace este bloque; si prefieres, también se puede activar en el panel de Supabase:
-- Database → Replication.
-- (bloque re-ejecutable: no repite una tabla que ya está en la publicación)
-- ─────────────────────────────────────────────

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- fuera de Supabase (o con Realtime apagado): nada que hacer
  end if;
  foreach t in array array['contact_messages', 'prospectos'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

