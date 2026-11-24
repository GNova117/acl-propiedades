-- ─────────────────────────────────────────────
-- Solicitud de avalúo inmobiliario y dictamen técnico de calidad (2026-10-08)
-- — mismos campos y 4 secciones que el formato INFONAVIT en papel, para
-- llenarlo en línea y descargarlo de nuevo en PDF (membretado ACL). No está
-- ligada obligatoriamente a un cliente/propiedad del catálogo: cliente_id y
-- propiedad_id son solo referencia opcional. Mismo patrón que perfilamientos
-- (ver arriba): RLS con el apartado 'valuacion'.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────
create table if not exists solicitudes_avaluo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clients(id) on delete set null,
  propiedad_id uuid references properties(id) on delete set null,

  -- Destino del crédito
  destino_credito text check (
    destino_credito is null or destino_credito in (
      'Comprar una vivienda', 'Construir tu vivienda', 'Ampliar, remodelar o mejorar tu vivienda', 'Pagar la hipoteca de tu vivienda'
    )
  ),

  -- Sección 1: datos de identificación del derechohabiente
  nss text,
  dh_apellido_paterno text,
  dh_apellido_materno text,
  dh_nombres text,
  dh_calle_numero text,
  dh_colonia text,
  dh_municipio text,
  dh_estado text,
  dh_codigo_postal text,
  dh_telefono_casa text,
  dh_telefono_trabajo text,
  dh_telefono_celular text,

  -- Sección 2: datos del propietario actual de la vivienda
  prop_apellido_paterno text,
  prop_apellido_materno text,
  prop_nombre_razon_social text,
  prop_rfc text,
  prop_acreedor_hipotecario text,
  prop_rfc_acreedor text,
  prop_calle_numero text,
  prop_colonia text,
  prop_municipio text,
  prop_estado text,
  prop_codigo_postal text,
  prop_telefono_trabajo text,
  prop_telefono_celular text,

  -- Sección 3: datos de la vivienda objeto del crédito
  viv_clave_conjunto text,
  viv_calle text,
  viv_numero_exterior text,
  viv_numero_interior text,
  viv_lote text,
  viv_manzana text,
  viv_colonia text,
  viv_municipio text,
  viv_estado text,
  viv_codigo_postal text,
  viv_antiguedad integer,

  -- Sección 4: lugar y fecha de la solicitud
  ciudad_solicitud text,
  fecha_solicitud date,
  notas text,

  usuario_creo text,
  fecha_creacion timestamptz not null default now(),
  fecha_modificacion timestamptz not null default now()
);

create index if not exists idx_solicitudes_avaluo_cliente on solicitudes_avaluo(cliente_id);
create index if not exists idx_solicitudes_avaluo_fecha on solicitudes_avaluo(fecha_creacion desc);

alter table solicitudes_avaluo enable row level security;

drop policy if exists "Rol con apartado valuacion maneja solicitudes_avaluo" on solicitudes_avaluo;
create policy "Rol con apartado valuacion maneja solicitudes_avaluo" on solicitudes_avaluo for all
  using (has_admin_section('valuacion')) with check (has_admin_section('valuacion'));

