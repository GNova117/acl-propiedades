-- ─────────────────────────────────────────────
-- Testimonios administrables (/admin/testimonios) + sección de confianza
-- en el inicio ("Lo que dicen nuestros clientes"). A diferencia de
-- zonas/tipos de propiedad/amenidades (que son taxonomía de propiedades y
-- comparten el apartado "zonas"), esto es contenido de marketing —
-- distinto lo suficiente como para tener su propio apartado, mismo
-- criterio que se usó para "documentos_legales". Mismo nivel de RLS que
-- amenities_catalog: público puede leer todo (el filtro de "activo" para
-- el sitio público se hace en el cliente, no en RLS), autenticado
-- administra todo.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  quote text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;

drop policy if exists "Public can read testimonials" on testimonials;
create policy "Public can read testimonials" on testimonials for select using (true);

drop policy if exists "Authenticated manage testimonials" on testimonials;
create policy "Authenticated manage testimonials" on testimonials for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

update admin_roles
set sections = array_append(sections, 'testimonios')
where slug = 'admin' and not ('testimonios' = any(sections));

