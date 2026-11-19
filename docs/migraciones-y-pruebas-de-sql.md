# Migraciones y entorno de pruebas del SQL

## Cómo está organizado

- `supabase/migrations/NNNN_titulo.sql` — **la fuente**: una migración por bloque, en orden (hoy 116).
- `supabase/schema.sql` — se **genera** uniendo las migraciones (`npm run schema:build`). Sigue sirviendo para pegarlo completo en
  el SQL Editor de una base nueva. CI falla si no coincide con las migraciones (`npm run schema:check`).
- `scripts/migrate.mjs` aplica las pendientes y lleva la cuenta en `supabase_migrations.schema_migrations` (la misma tabla que usa la
  CLI de Supabase, así que `supabase db push` también sirve).

## Una sola vez: poner al día la base de producción (que ya tiene todo aplicado a mano)

No hay que volver a correr nada: solo **marcar** lo existente como aplicado.

```bash
export DATABASE_URL='postgresql://postgres:…@…supabase.co:5432/postgres'   # Project Settings → Database → Connection string
npm run db:migrate -- status                  # todo aparece pendiente
npm run db:migrate -- baseline --through 0114 # marca 0001…0114 como aplicadas (SIN ejecutarlas)
npm run db:migrate -- status                  # 114 aplicadas, 0 pendientes
```

**Antes de marcar, confirma que producción de verdad tiene todos los bloques** (el 0112 «Monitoreo de errores», 0113 «Tiempo real»,
0114 «Conteo por tipo» son de este último lote). Si falta alguno, haz `baseline` hasta la última que SÍ tiene y deja que `up` aplique el resto.

## Agregar un cambio de SQL (de hoy en adelante)

```bash
npm run migration:new -- "Qué hace este cambio"   # crea supabase/migrations/0115_que_hace_este_cambio.sql
# …escribe el SQL (idealmente re-ejecutable)…
npm run schema:build                              # regenera supabase/schema.sql
git add supabase && git commit
# al desplegar:
npm run db:migrate -- up                          # aplica solo lo pendiente
```

Cada migración corre en **su propia transacción**: si algo falla, esa migración no queda a medias y las anteriores siguen aplicadas.
Las migraciones viejas **no se pueden volver a correr** sobre una base más nueva (varias de la primera época no eran re-ejecutables y
otras reemplazan lo que bloques posteriores cambiaron): justo para eso existe la cuenta de las ya aplicadas. No edites una migración
ya aplicada en producción; agrega una nueva.

## Entorno de pruebas

1. **Automático (CI):** el trabajo `sql` levanta un Postgres, aplica las 114 migraciones desde cero, comprueba que una segunda corrida
   no tenga nada pendiente y corre `supabase/testdb/tests/*.sql`. Ver `supabase/testdb/README.md`. También se puede correr en tu computadora.
2. **Un proyecto de Supabase aparte (staging) — lo tienes que crear tú:** crea otro proyecto en Supabase (el plan gratuito sirve),
   apunta `DATABASE_URL` a él y corre `npm run db:migrate -- up`; despliega las funciones con `supabase functions deploy <nombre> --project-ref <staging>`
   y, en Vercel, define para los «Preview» las variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de ese proyecto (así cada rama prueba contra la base de pruebas,
   no contra producción). Es el único modo de probar de verdad Auth/MFA, Realtime, Storage y los correos antes de producción.
