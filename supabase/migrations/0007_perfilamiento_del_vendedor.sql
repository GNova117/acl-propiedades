-- ─────────────────────────────────────────────
-- Perfilamiento del vendedor (uno por inmueble; un cliente puede tener varios)
-- Contiene datos personales sensibles (RFC, CURP, identificación): tabla
-- 100% interna, sin lectura pública.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists perfilamientos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clients(id) on delete cascade,

  -- Sección 1: datos generales del vendedor
  nombre_completo text not null,
  fecha_nacimiento date not null,
  estado_civil text check (estado_civil in ('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre')),
  domicilio text not null,
  correo text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono text check (telefono is null or telefono ~ '^[0-9]{10}$'),
  rfc text check (rfc is null or rfc ~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$'),
  curp text check (curp is null or curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$'),
  identificacion_oficial text,

  -- Sección 2: datos generales del inmueble
  ubicacion text not null,
  tipo_inmueble text check (tipo_inmueble in ('Casa habitación', 'Departamento', 'Terreno', 'Local comercial', 'Bodega', 'Otro')),
  caracteristicas text,
  superficie_terreno numeric,
  superficie_construccion numeric,
  uso_suelo text,
  antiguedad integer,
  forma_adquisicion text check (forma_adquisicion in ('Infonavit', 'Fovissste', 'Crédito bancario', 'Compraventa', 'Herencia', 'Donación', 'Otro')),
  gravamenes text check (gravamenes in ('Libre de gravamen', 'Con gravamen')),
  gravamenes_detalle text,
  registro_partida text,
  registro_libro text,
  registro_seccion text,
  registro_fecha_inscripcion date,

  usuario_creo text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz not null default now()
);

create index if not exists idx_perfilamientos_cliente on perfilamientos(cliente_id);

alter table perfilamientos enable row level security;

drop policy if exists "Authenticated manage perfilamientos" on perfilamientos;
create policy "Authenticated manage perfilamientos" on perfilamientos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

