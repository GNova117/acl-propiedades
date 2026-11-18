-- ─────────────────────────────────────────────
-- Solicitud de Inscripción de Crédito (2026-10-09) — formato INFONAVIT
-- CRED.1000.25 (3 hojas), para llenarlo en línea y descargarlo de nuevo en
-- PDF. A diferencia de solicitudes_avaluo, el PDF oficial de este formato
-- SÍ trae campos de formulario reales (AcroForm): se llena por nombre de
-- campo, no por coordenadas — ver src/lib/solicitudCreditoPdf.js. Mismo
-- patrón que solicitudes_avaluo: cliente_id/propiedad_id son solo
-- referencia opcional, RLS con el apartado 'credito_infonavit' (mismo que
-- ya usa el Simulador de crédito Infonavit).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists solicitudes_credito (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clients(id) on delete set null,
  propiedad_id uuid references properties(id) on delete set null,

  -- 1. Crédito solicitado
  producto text,
  entidad_financiera text,
  tipo_credito text,
  tipo_credito_corresidencial text,
  familiar text,
  destino_credito text,

  -- 2. Datos para determinar el monto de crédito
  desc_pension_dh numeric,
  desc_pension_cfc numeric,
  monto_credito_dh numeric,
  monto_credito_cfc numeric,
  monto_ahorro numeric,
  equipa_tu_casa text,

  -- 3. Datos de la vivienda/terreno destino del crédito
  viv_calle text,
  viv_num_ext text,
  viv_num_int text,
  viv_lote text,
  viv_mza text,
  viv_colonia text,
  viv_entidad text,
  viv_municipio text,
  viv_cp text,
  discapacidad text,
  tipo_discapacidad text,
  persona_discapacidad text,
  precio_compraventa numeric,
  monto_presupuesto_construccion numeric,
  monto_presupuesto_reparar numeric,
  monto_deuda numeric,
  afectacion_estructural text,

  -- 4. Datos de la empresa o patrón
  empresa_nombre text,
  empresa_nrp text,
  empresa_lada text,
  empresa_numero text,
  empresa_ext text,

  -- 5. Datos de identificación del derechohabiente
  nss text,
  curp text,
  rfc text,
  apellido_paterno text,
  apellido_materno text,
  nombres text,
  domicilio_calle text,
  domicilio_colonia text,
  domicilio_entidad text,
  domicilio_delegacion text,
  domicilio_cp text,
  telefono_lada text,
  telefono_numero text,
  celular text,
  email text,
  genero text,
  estado_civil text,
  regimen_patrimonial text,

  -- 6. Datos de identificación del cónyuge, familiar o corresidente
  cfc_nss text,
  cfc_curp text,
  cfc_rfc text,
  cfc_apellido_paterno text,
  cfc_apellido_materno text,
  cfc_nombre text,
  cfc_lada text,
  cfc_numero text,
  cfc_celular text,
  cfc_email text,
  cfc_genero text,
  cfc_empresa_nombre text,
  cfc_empresa_nrp text,

  -- 7. Referencias familiares del derechohabiente (2)
  ref1_paterno text,
  ref1_materno text,
  ref1_nombre text,
  ref1_lada text,
  ref1_numero text,
  ref1_celular text,
  ref1_calle text,
  ref1_colonia text,
  ref1_entidad text,
  ref1_delegacion text,
  ref1_cp text,
  ref2_paterno text,
  ref2_materno text,
  ref2_nombre text,
  ref2_lada text,
  ref2_numero text,
  ref2_celular text,
  ref2_calle text,
  ref2_colonia text,
  ref2_entidad text,
  ref2_delegacion text,
  ref2_cp text,

  -- 8. Datos para abono en cuenta del crédito
  vendedor_tipo text,
  vendedor_nombre text,
  vendedor_rfc text,
  vendedor_razon_social_cuenta text,
  vendedor_clabe text,
  acreedor_nombre text,
  acreedor_rfc text,
  acreedor_razon_social_cuenta text,
  acreedor_clabe text,
  numero_credito_titular text,
  numero_credito_cfc text,
  numero_inventario_vr text,
  numero_credito_entidad text,

  -- 9. Designación de representante
  repres_paterno text,
  repres_materno text,
  repres_nombre text,
  repres_lada text,
  repres_numero text,
  repres_celular text,
  repres_identificacion text,

  -- 10. Datos de identificación del contacto
  contacto_tipo text,
  contacto_curp text,
  contacto_paterno text,
  contacto_materno text,
  contacto_nombre text,
  contacto_lada text,
  contacto_numero text,

  -- 11. Oferta vinculante
  oferta_vinculante text,
  ciudad text,
  fecha_solicitud date,

  usuario_creo text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz not null default now()
);

create index if not exists idx_solicitudes_credito_cliente on solicitudes_credito(cliente_id);
create index if not exists idx_solicitudes_credito_fecha on solicitudes_credito(fecha_creacion desc);

alter table solicitudes_credito enable row level security;

drop policy if exists "Rol con apartado credito_infonavit maneja solicitudes_credito" on solicitudes_credito;
create policy "Rol con apartado credito_infonavit maneja solicitudes_credito" on solicitudes_credito for all
  using (has_admin_section('credito_infonavit')) with check (has_admin_section('credito_infonavit'));

