-- ─────────────────────────────────────────────
-- "Mis ventas" en el Panel principal para un asesor (2026-10-01)
-- Hasta ahora `ventas` solo era legible con el apartado 'reportes' (interno,
-- de oficina) — un asesor con login vinculado no podía ver ni sus propias
-- ventas sin ese apartado, que además da acceso a cifras de todo el equipo
-- y, si también tiene 'liquidaciones', al margen/comisión de la oficina.
-- Esta póliza adicional (se suma a la de arriba, no la reemplaza: en RLS
-- varias políticas permissive para el mismo comando se combinan con OR) le
-- deja leer solo sus propias filas — sin apartado nuevo, sin exponer nada
-- de otro asesor ni de la oficina. Insertar/editar/borrar una venta sigue
-- siendo exclusivo de 'reportes' (esta póliza es "for select" nada más).
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

drop policy if exists "Asesor ve sus propias ventas" on ventas;
create policy "Asesor ve sus propias ventas" on ventas for select
  using (my_advisor_id() is not null and my_advisor_id() = advisor_id);

