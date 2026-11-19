-- ─────────────────────────────────────────────
-- Construcción · acabados por zona (2026-10)
-- Las columnas tipo_piso / tipo_pared / tipo_techo ya estaban en la tabla original; este bloque solo se
-- asegura de que existan (re-ejecutable). Guardan el id del acabado elegido (porcelanato, pintura_azul,
-- dos_aguas_teja…). Si no existieran, todo funciona pero los acabados no sobreviven a recargar.
-- ─────────────────────────────────────────────
alter table construccion_habitaciones add column if not exists tipo_piso text;
alter table construccion_habitaciones add column if not exists tipo_pared text;
alter table construccion_habitaciones add column if not exists tipo_techo text;

