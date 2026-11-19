-- ─────────────────────────────────────────────
-- Visitas: "posible cliente" (2026-09-23)
-- Un prospecto que conoció ACL por una casa pero quiere que le busquemos otra
-- se marca en la propia visita: `potential_client` + su teléfono y "qué busca"
-- (tipo, zona, presupuesto). Los tres son SOLO internos, igual que
-- prospect_name/internal_notes: el informe del vendedor sale de
-- _visit_report_payload(), que arma el JSON con una lista cerrada de campos y no
-- los incluye. La RLS de property_visits ya cubre las columnas nuevas (cada
-- asesor ve las suyas; oficina ve todas).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

alter table property_visits add column if not exists potential_client boolean not null default false;
alter table property_visits add column if not exists prospect_phone text;
alter table property_visits add column if not exists looking_for text;

