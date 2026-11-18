-- ─────────────────────────────────────────────
-- Blog / artículos (2026-10-01, apartado 'blog'): contenido propio del sitio
-- para SEO ("Guía para comprar en La Comarca Lagunera" y similares),
-- administrable desde /admin/blog. Público en /blog y /blog/:slug, pero
-- SOLO lo publicado — a diferencia de `testimonials` (cuyo select público
-- es `using (true)`, filtrado solo en el cliente), aquí un borrador de
-- verdad no es legible por nadie fuera de un login de staff, porque puede
-- traer texto a medio escribir. El slug se genera del título con
-- slugify() (mismo helper que ya usan property_types) y debe ser único; si
-- el título se repite, el código del admin le agrega un sufijo corto al
-- guardar. Imágenes de portada van al bucket público 'blog-images' (arriba
-- en este archivo), subidas con el mismo uploadFiles() que ya usan
-- advisor-photos/property-images.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null,
  cover_image text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_published on blog_posts(published, published_at desc);

alter table blog_posts enable row level security;

drop policy if exists "Public lee blog publicado" on blog_posts;
create policy "Public lee blog publicado" on blog_posts for select using (published = true);

drop policy if exists "Authenticated administra blog" on blog_posts;
create policy "Authenticated administra blog" on blog_posts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

update admin_roles
set sections = array_append(sections, 'blog')
where slug = 'admin' and not ('blog' = any(sections));

