-- ─────────────────────────────────────────────
-- Contactos duplicados
-- ─────────────────────────────────────────────
-- Antes de guardar un prospecto nuevo, el panel pregunta si ya existe alguien
-- con el mismo teléfono (últimos 10 dígitos, sin importar el formato) o correo,
-- entre los prospectos y los clientes. Va por una función security definer
-- porque RLS deja a cada asesor ver solo sus prospectos y el aviso debe cubrir
-- los de todos: del prospecto ajeno solo se devuelve nombre, etapa y asesor
-- (sin id, no se puede abrir), nunca teléfono, correo ni notas. Los clientes
-- solo se incluyen a quien tiene el apartado 'clientes'. La misma regla está
-- en src/lib/duplicates.js (modo demo); si cambia aquí, cambia allá.
-- Re-ejecutable. Sin correrla, el panel simplemente no avisa de duplicados.
create or replace function find_contact_duplicates(p_phone text, p_email text default null, p_exclude uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_me uuid := my_advisor_id();
  v_found jsonb := '[]'::jsonb;
  v_clients jsonb := '[]'::jsonb;
begin
  if length(v_phone) < 10 then v_phone := null; end if;
  if v_email = '' then v_email := null; end if;
  if v_phone is null and v_email is null then return v_found; end if;

  if has_admin_section('prospectos') then
    select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) into v_found
    from (
      select
        'prospect' as kind,
        case when v_me is null or p.advisor_id = v_me then p.id end as id,
        p.name,
        p.stage,
        a.name as advisor_name,
        (v_me is null or p.advisor_id = v_me) as mine,
        case when v_phone is not null and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone then 'phone' else 'email' end as matched
      from prospectos p
      left join advisors a on a.id = p.advisor_id
      where (p_exclude is null or p.id <> p_exclude)
        and (
          (v_phone is not null and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_phone)
          or (v_email is not null and lower(btrim(coalesce(p.email, ''))) = v_email)
        )
      order by p.created_at desc
      limit 5
    ) x;
  end if;

  if has_admin_section('clientes') then
    select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) into v_clients
    from (
      select
        'client' as kind,
        c.id,
        c.name,
        null::text as stage,
        null::text as advisor_name,
        true as mine,
        case when v_phone is not null and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_phone then 'phone' else 'email' end as matched
      from clients c
      where (
        (v_phone is not null and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_phone)
        or (v_email is not null and lower(btrim(coalesce(c.email, ''))) = v_email)
      )
      order by c.created_at desc
      limit 5
    ) x;
  end if;

  return v_found || v_clients;
end;
$$;

revoke execute on function find_contact_duplicates(text, text, uuid) from public, anon;
grant execute on function find_contact_duplicates(text, text, uuid) to authenticated;

