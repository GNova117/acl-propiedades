-- ─────────────────────────────────────────────
-- Edición de perfil propio para asesores (2026-10-12)
-- Un login vinculado a un asesor (my_advisor_id() no nulo) puede editar su
-- propia fila de advisors sin necesitar la sección 'asesores' — ver
-- AdminMyProfile.jsx, ruta /admin/mi-perfil. Antes de esto, un asesor sin
-- esa sección (la normal para un asesor: la da la oficina) no podía
-- actualizar ni su teléfono ni su foto por sí mismo.
--
-- Este policy es ADICIONAL al de la oficina ("Rol con apartado asesores
-- maneja advisors" for all, más arriba): varios policies permisivos para el
-- mismo comando se combinan con OR, así que no hace falta tocar aquél.
-- Solo cubre UPDATE (no INSERT/DELETE): un asesor no crea ni borra asesores,
-- solo edita el suyo.
--
-- active/show_in_team quedan fuera a propósito: son del control de la
-- oficina (activar/desactivar a alguien, o sacarlo de la página de
-- Nosotros), no algo que uno mismo deba poder tocar. El formulario de
-- AdminMyProfile ya no los manda, pero el trigger de abajo es la garantía
-- real: si la fila se edita sin la sección 'asesores' (el caso de este
-- policy), esas dos columnas se devuelven a su valor anterior sin importar
-- qué haya mandado el cliente.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

drop policy if exists "Asesor edita su propio perfil" on advisors;
create policy "Asesor edita su propio perfil" on advisors for update
  using (my_advisor_id() is not null and my_advisor_id() = id)
  with check (my_advisor_id() is not null and my_advisor_id() = id);

create or replace function advisors_guard_self_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_admin_section('asesores') then
    new.active := old.active;
    new.show_in_team := old.show_in_team;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_advisors_guard_self_edit on advisors;
create trigger trg_advisors_guard_self_edit
before update on advisors
for each row
execute function advisors_guard_self_edit();

-- Fotos: se suben a advisor-photos/<id-del-asesor>/<archivo> desde
-- AdminMyProfile (ver updateAdvisor en supabaseBackend.js, que prefija la
-- ruta con el id). La política de la oficina ("Rol con apartado asesores
-- sube fotos de asesor") sigue intacta; esta se suma para permitir subir
-- solo dentro de la propia carpeta.
drop policy if exists "Asesor sube su propia foto" on storage.objects;
create policy "Asesor sube su propia foto" on storage.objects
  for insert with check (
    bucket_id = 'advisor-photos'
    and my_advisor_id() is not null
    and (storage.foldername(name))[1] = my_advisor_id()::text
  );


