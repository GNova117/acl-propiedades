-- ─────────────────────────────────────────────
-- Perfilamiento del comprador (uno o varios por cliente)
-- Contiene datos personales sensibles (NSS, CURP, RFC) y, a petición
-- explícita del negocio, la contraseña del portal de crédito del comprador
-- (INFONAVIT/FOVISSSTE/banco) en texto plano — riesgo aceptado, ver README.
-- Tabla 100% interna, sin lectura pública.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists perfilamientos_comprador (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clients(id) on delete cascade,

  nombre text not null,
  nss text check (nss is null or nss ~ '^[0-9]{11}$'),
  telefono text check (telefono is null or telefono ~ '^[0-9]{10}$'),
  contrasena_portal text,
  fecha_nacimiento date not null,
  estado_civil text check (estado_civil in ('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre')),
  domicilio text not null,
  correo text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  curp text check (curp is null or curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$'),
  rfc text check (rfc is null or rfc ~ '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$'),
  registro_patronal text,
  tel_empresa text,
  razon_social text,
  referencia1_nombre text,
  referencia1_telefono text,
  referencia2_nombre text,
  referencia2_telefono text,

  usuario_creo text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz not null default now()
);

create index if not exists idx_perfilamientos_comprador_cliente on perfilamientos_comprador(cliente_id);

alter table perfilamientos_comprador enable row level security;

drop policy if exists "Authenticated manage perfilamientos_comprador" on perfilamientos_comprador;
create policy "Authenticated manage perfilamientos_comprador" on perfilamientos_comprador for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Nuevo documento capturable para el expediente del comprador: pago de
-- avalúo. Se busca y reemplaza el constraint existente por su definición
-- real (no por nombre adivinado), para no fallar si Postgres le puso un
-- nombre distinto al esperado.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'client_documents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%doc_type%'
  loop
    execute format('alter table client_documents drop constraint %I', con.conname);
  end loop;
end $$;

alter table client_documents add constraint client_documents_doc_type_check
  check (doc_type in ('ine', 'curp', 'cedula_fiscal', 'acta_nacimiento', 'pago_avaluo'));

