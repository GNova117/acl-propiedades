-- Tiempo real: mensajes y prospectos quedan en la publicación de Supabase.
do $$
begin
  assert exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'contact_messages'), 'contact_messages debe estar en supabase_realtime';
  assert exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'prospectos'), 'prospectos debe estar en supabase_realtime';
end $$;
