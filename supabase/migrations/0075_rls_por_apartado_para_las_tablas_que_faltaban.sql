-- ─────────────────────────────────────────────
-- RLS por apartado para las tablas que faltaban (2026-10)
--
-- Hasta este bloque, solo Clientes/Liquidaciones/Visitas/Bitácora/Reportes/
-- Valuación/Agenda/Secretaria/Inspecciones/Gastos/Prospectos/Documentos
-- legales/Roles bloqueaban de verdad por apartado en la base de datos (ver
-- "Roles y accesos" arriba). El resto —Zonas, Asesores, Propiedades/Naves
-- Industriales, Mensajes, Materiales, Remodelaciones, Testimonios, Blog y
-- Construcción— solo se ocultaban del menú y las rutas: cualquier cuenta
-- con sesión iniciada podía leerlas/escribirlas igual por la API de
-- Supabase, tuviera o no ese apartado en su rol. Este bloque cierra esa
-- brecha con el mismo patrón ya usado arriba (has_admin_section(...)).
--
-- Dónde SIGUE siendo pública la lectura (zonas, tipos de propiedad,
-- amenidades, asesores, propiedades, testimonios, blog publicado, fotos/
-- videos de propiedad, asesor y blog): sin cambios — esas tablas ya tenían
-- su propia política pública independiente ("Public can read ..."), así que
-- esto solo cierra escritura (insert/update/delete) a quien no tenga el
-- apartado. Construcción, Remodelaciones y Materiales son 100% internas
-- (nunca tuvieron lectura pública), así que ahí el cambio cierra también la
-- lectura.
--
-- Propiedades/Naves Industriales comparten la misma tabla `properties`
-- desde siempre (ver el bloque "Naves Industriales pasa a tener su propio
-- apartado" más arriba, que ya avisaba que esto quedaba pendiente): un rol
-- puede tener cualquiera de los dos apartados por separado, así que la
-- política exige uno U OTRO, nunca los dos a la vez.
--
-- ⚠️ IMPORTANTE antes de correr este bloque: revisa en /admin/roles que
-- cada rol que de verdad necesita cada uno de estos apartados ya lo tenga
-- marcado (el rol "Administrador" ya tiene todos). Una cuenta cuyo rol no
-- traiga el apartado correspondiente empieza a recibir 0 filas de esa tabla
-- en cuanto esto se corre — ya no por el menú, sino por la base de datos.
--
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

-- Zonas (zonas, tipos de propiedad y amenidades se administran juntos en
-- /admin/zonas, mismo apartado los tres).
drop policy if exists "Authenticated manage zones" on zones;
create policy "Rol con apartado zonas maneja zones" on zones for all
  using (has_admin_section('zonas')) with check (has_admin_section('zonas'));

drop policy if exists "Authenticated manage property_types" on property_types;
create policy "Rol con apartado zonas maneja property_types" on property_types for all
  using (has_admin_section('zonas')) with check (has_admin_section('zonas'));

drop policy if exists "Authenticated manage amenities_catalog" on amenities_catalog;
create policy "Rol con apartado zonas maneja amenities_catalog" on amenities_catalog for all
  using (has_admin_section('zonas')) with check (has_admin_section('zonas'));

-- Asesores
drop policy if exists "Authenticated manage advisors" on advisors;
create policy "Rol con apartado asesores maneja advisors" on advisors for all
  using (has_admin_section('asesores')) with check (has_admin_section('asesores'));

drop policy if exists "Authenticated can upload advisor photos" on storage.objects;
create policy "Rol con apartado asesores sube fotos de asesor" on storage.objects
  for insert with check (bucket_id = 'advisor-photos' and has_admin_section('asesores'));

drop policy if exists "Authenticated can delete advisor photos" on storage.objects;
create policy "Rol con apartado asesores borra fotos de asesor" on storage.objects
  for delete using (bucket_id = 'advisor-photos' and has_admin_section('asesores'));

-- Propiedades / Naves Industriales: mismas tablas, apartados distintos —
-- cualquiera de los dos basta (ver nota arriba).
drop policy if exists "Authenticated manage properties" on properties;
create policy "Rol con apartado propiedades o naves_industriales maneja properties" on properties for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

drop policy if exists "Authenticated manage property_advisors" on property_advisors;
create policy "Rol con apartado propiedades o naves_industriales maneja property_advisors" on property_advisors for all
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'))
  with check (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

drop policy if exists "Authenticated read property_changes" on property_changes;
create policy "Rol con apartado propiedades o naves_industriales lee property_changes" on property_changes for select
  using (has_admin_section('propiedades') or has_admin_section('naves_industriales'));

drop policy if exists "Authenticated can upload property images" on storage.objects;
create policy "Rol con apartado propiedades o naves sube fotos de propiedad" on storage.objects
  for insert with check (bucket_id = 'property-images' and (has_admin_section('propiedades') or has_admin_section('naves_industriales')));

drop policy if exists "Authenticated can delete property images" on storage.objects;
create policy "Rol con apartado propiedades o naves borra fotos de propiedad" on storage.objects
  for delete using (bucket_id = 'property-images' and (has_admin_section('propiedades') or has_admin_section('naves_industriales')));

drop policy if exists "Authenticated can upload property videos" on storage.objects;
create policy "Rol con apartado propiedades o naves sube videos de propiedad" on storage.objects
  for insert with check (bucket_id = 'property-videos' and (has_admin_section('propiedades') or has_admin_section('naves_industriales')));

drop policy if exists "Authenticated can delete property videos" on storage.objects;
create policy "Rol con apartado propiedades o naves borra videos de propiedad" on storage.objects
  for delete using (bucket_id = 'property-videos' and (has_admin_section('propiedades') or has_admin_section('naves_industriales')));

-- Mensajes (el insert público del formulario de contacto no se toca)
drop policy if exists "Authenticated read contact messages" on contact_messages;
create policy "Rol con apartado mensajes lee contact_messages" on contact_messages for select
  using (has_admin_section('mensajes'));

drop policy if exists "Authenticated update contact messages" on contact_messages;
create policy "Rol con apartado mensajes actualiza contact_messages" on contact_messages for update
  using (has_admin_section('mensajes')) with check (has_admin_section('mensajes'));

drop policy if exists "Authenticated delete contact messages" on contact_messages;
create policy "Rol con apartado mensajes borra contact_messages" on contact_messages for delete
  using (has_admin_section('mensajes'));

-- Materiales (catálogo de materiales y de mano de obra, misma pantalla)
drop policy if exists "Authenticated manage materials_catalog" on materials_catalog;
create policy "Rol con apartado materiales maneja materials_catalog" on materials_catalog for all
  using (has_admin_section('materiales')) with check (has_admin_section('materiales'));

drop policy if exists "Authenticated manage labor_catalog" on labor_catalog;
create policy "Rol con apartado materiales maneja labor_catalog" on labor_catalog for all
  using (has_admin_section('materiales')) with check (has_admin_section('materiales'));

-- Remodelaciones
drop policy if exists "Authenticated manage remodel_projects" on remodel_projects;
create policy "Rol con apartado remodelaciones maneja remodel_projects" on remodel_projects for all
  using (has_admin_section('remodelaciones')) with check (has_admin_section('remodelaciones'));

drop policy if exists "Authenticated manage remodel_progress_entries" on remodel_progress_entries;
create policy "Rol con apartado remodelaciones maneja remodel_progress_entries" on remodel_progress_entries for all
  using (has_admin_section('remodelaciones')) with check (has_admin_section('remodelaciones'));

drop policy if exists "Authenticated can view remodel progress photos" on storage.objects;
create policy "Rol con apartado remodelaciones ve fotos de avance" on storage.objects
  for select using (bucket_id = 'remodel-progress' and has_admin_section('remodelaciones'));

drop policy if exists "Authenticated can upload remodel progress photos" on storage.objects;
create policy "Rol con apartado remodelaciones sube fotos de avance" on storage.objects
  for insert with check (bucket_id = 'remodel-progress' and has_admin_section('remodelaciones'));

drop policy if exists "Authenticated can delete remodel progress photos" on storage.objects;
create policy "Rol con apartado remodelaciones borra fotos de avance" on storage.objects
  for delete using (bucket_id = 'remodel-progress' and has_admin_section('remodelaciones'));

-- Testimonios (la lectura pública de testimonios publicados no se toca)
drop policy if exists "Authenticated manage testimonials" on testimonials;
create policy "Rol con apartado testimonios maneja testimonials" on testimonials for all
  using (has_admin_section('testimonios')) with check (has_admin_section('testimonios'));

-- Blog (la lectura pública de entradas publicadas no se toca). Depende del
-- bloque "Blog" que crea `blog_posts` y el bucket `blog-images` más arriba
-- en este archivo — si no se ha corrido (el blog no está desplegado en el
-- proyecto, como en producción al 2026-10), esta parte falla con "relation
-- blog_posts does not exist"; sáltatela hasta que exista esa tabla.
drop policy if exists "Authenticated administra blog" on blog_posts;
create policy "Rol con apartado blog administra blog_posts" on blog_posts for all
  using (has_admin_section('blog')) with check (has_admin_section('blog'));

drop policy if exists "Authenticated can upload blog images" on storage.objects;
create policy "Rol con apartado blog sube imágenes de blog" on storage.objects
  for insert with check (bucket_id = 'blog-images' and has_admin_section('blog'));

drop policy if exists "Authenticated can delete blog images" on storage.objects;
create policy "Rol con apartado blog borra imágenes de blog" on storage.objects
  for delete using (bucket_id = 'blog-images' and has_admin_section('blog'));

-- Construcción (todas 100% internas, nunca tuvieron lectura pública)
drop policy if exists "Authenticated manage construccion_proyectos" on construccion_proyectos;
create policy "Rol con apartado construccion maneja construccion_proyectos" on construccion_proyectos for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_habitaciones" on construccion_habitaciones;
create policy "Rol con apartado construccion maneja construccion_habitaciones" on construccion_habitaciones for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_muros" on construccion_muros;
create policy "Rol con apartado construccion maneja construccion_muros" on construccion_muros for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_aberturas" on construccion_aberturas;
create policy "Rol con apartado construccion maneja construccion_aberturas" on construccion_aberturas for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_catalogo_materiales" on construccion_catalogo_materiales;
create policy "Rol con apartado construccion maneja construccion_catalogo_materiales" on construccion_catalogo_materiales for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_objetos" on construccion_objetos;
create policy "Rol con apartado construccion maneja construccion_objetos" on construccion_objetos for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_niveles" on construccion_niveles;
create policy "Rol con apartado construccion maneja construccion_niveles" on construccion_niveles for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_fotos" on construccion_fotos;
create policy "Rol con apartado construccion maneja construccion_fotos" on construccion_fotos for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated view construccion fotos" on storage.objects;
create policy "Rol con apartado construccion ve fotos" on storage.objects
  for select using (bucket_id = 'construccion-fotos' and has_admin_section('construccion'));

drop policy if exists "Authenticated upload construccion fotos" on storage.objects;
create policy "Rol con apartado construccion sube fotos" on storage.objects
  for insert with check (bucket_id = 'construccion-fotos' and has_admin_section('construccion'));

drop policy if exists "Authenticated delete construccion fotos" on storage.objects;
create policy "Rol con apartado construccion borra fotos" on storage.objects
  for delete using (bucket_id = 'construccion-fotos' and has_admin_section('construccion'));

drop policy if exists "Authenticated manage construccion_fondos" on construccion_fondos;
create policy "Rol con apartado construccion maneja construccion_fondos" on construccion_fondos for all
  using (has_admin_section('construccion')) with check (has_admin_section('construccion'));

drop policy if exists "Authenticated view construccion fondos" on storage.objects;
create policy "Rol con apartado construccion ve fondos" on storage.objects
  for select using (bucket_id = 'construccion-fondos' and has_admin_section('construccion'));

drop policy if exists "Authenticated upload construccion fondos" on storage.objects;
create policy "Rol con apartado construccion sube fondos" on storage.objects
  for insert with check (bucket_id = 'construccion-fondos' and has_admin_section('construccion'));

drop policy if exists "Authenticated update construccion fondos" on storage.objects;
create policy "Rol con apartado construccion actualiza fondos" on storage.objects
  for update using (bucket_id = 'construccion-fondos' and has_admin_section('construccion'));

drop policy if exists "Authenticated delete construccion fondos" on storage.objects;
create policy "Rol con apartado construccion borra fondos" on storage.objects
  for delete using (bucket_id = 'construccion-fondos' and has_admin_section('construccion'));

