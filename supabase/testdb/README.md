# Base de pruebas para el SQL

Aplica **todas** las migraciones de `supabase/migrations/` a un Postgres común y corre `supabase/testdb/tests/*.sql`
(con `assert`), para probar el SQL **antes** de tocar producción. Es lo que corre el trabajo `sql` de CI (`.github/workflows/ci.yml`).

No es Supabase: `stubs.sql` simula lo mínimo que Supabase ya trae (roles `anon`/`authenticated`/`service_role`, `auth.*`,
`storage.*`, `vault`, la publicación `supabase_realtime`) y `install-stub-extensions.sh` crea versiones «de mentira» de
`pg_cron` y `pg_net`. Lo que NO prueba: las funciones reales de Supabase (Auth, Realtime, Storage), `pg_cron` ejecutando de
verdad ni el rendimiento.

## Local (necesitas Postgres 15+ con sus herramientas y permiso para escribir en su carpeta de extensiones)

```bash
createdb acltest
sudo bash supabase/testdb/install-stub-extensions.sh      # una vez (con pg_config en el PATH)
export DATABASE_URL=postgresql://localhost/acltest
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/testdb/stubs.sql
npm run db:migrate -- up        # aplica las migraciones, cada una en su transacción
npm run db:test                 # corre supabase/testdb/tests/*.sql
```

`db:test` se niega a correr contra una URL de Supabase (crea y revierte datos). Para empezar de cero: `dropdb acltest && createdb acltest`.

## Agregar una prueba

Un archivo `NN_tema.sql` en `supabase/testdb/tests/`. Usa `assert condición, 'mensaje'` dentro de un `do $$ … $$` y, si toca
datos, envuélvelo en `begin; … rollback;`. Para actuar como un visitante: `set local role anon;` y
`select set_config('request.jwt.claim.role','anon',true), set_config('request.headers','{"x-forwarded-for":"1.2.3.4"}',true);`.
