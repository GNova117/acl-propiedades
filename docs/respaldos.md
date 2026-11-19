# Respaldos automáticos

El trabajo **Respaldo** (`.github/workflows/backup.yml`) corre solo **cada domingo a las 3:00 am (hora de México)** y cuando lo pidas a mano
(pestaña **Actions → Respaldo → Run workflow**). Guarda dos archivos **cifrados** (AES-256) como artefacto del trabajo:

- `db-AAAA-MM-DD.dump.gpg` — los datos del sitio (`public`) y las cuentas del panel (`auth`), hechos con `pg_dump` y comprobados con `pg_restore --list` antes de cifrarse.
- `storage-AAAA-MM-DD.tar.gpg` — los archivos de Supabase Storage (fotos, INE, PDFs, planos…), con un `manifest.json` de lo que se bajó.

## Lo que tienes que hacer tú (una sola vez)

En GitHub → Settings → Secrets and variables → Actions → **Secrets**:

| Secreto | Qué es |
|---|---|
| `SUPABASE_DB_URL` | Cadena de conexión de la base. **Usa la «Session pooler»** (Supabase → Project Settings → Database → Connection string): la conexión directa es solo IPv6 y los servidores de GitHub no la alcanzan. |
| `SUPABASE_URL` | La URL del proyecto (`https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | La llave `service_role` (Project Settings → API). **Lee todo el Storage**: solo en este secreto. |
| `BACKUP_PASSPHRASE` | Una frase larga y aleatoria con la que se cifra todo. **Guárdala también fuera de GitHub** (gestor de contraseñas): sin ella los respaldos no se pueden abrir. |

Variables opcionales (pestaña **Variables**): `BACKUP_MAX_GB` (tope de lo que se baja de Storage, 2 por omisión) y `BACKUP_RETENTION_DAYS` (cuántos días se conserva cada respaldo, 60 por omisión; GitHub permite hasta 90).

## Cómo comprobar que funciona

1. Corre el trabajo a mano una vez. Debe terminar en verde y dejar el artefacto `respaldo-…`.
2. Descárgalo, descifra la base y restáurala **en una base de pruebas** (nunca encima de producción):

```bash
gpg --decrypt db-2026-11-22.dump.gpg > db.dump            # pide la frase (BACKUP_PASSPHRASE)
createdb restauracion
pg_restore --no-owner --clean --if-exists -d restauracion db.dump
psql restauracion -c "select count(*) from public.properties"
gpg --decrypt storage-2026-11-22.tar.gpg | tar -x          # los archivos, en ./storage/<bucket>/…
```

El flujo de la base (respaldo → cifrar → descifrar → restaurar → los datos están) se probó contra un Postgres 16 real; **el trabajo de GitHub en sí y la descarga de Storage de un proyecto de Supabase real no se han corrido todavía**: el primer disparo manual es la prueba.

## Límites (a propósito, para que no te sorprendan)

- Es un respaldo **semanal**: lo capturado entre un domingo y la falla se pierde. Si necesitas menos, cambia el `cron` (diario cuesta lo mismo) o activa los respaldos diarios y la recuperación a un punto en el tiempo de Supabase (plan Pro), que son complementarios.
- Los artefactos de GitHub **caducan** (60 días por omisión) y viven en la misma cuenta que el código. Para una copia verdaderamente aparte, descarga uno cada mes y guárdalo en otro lugar (disco externo, Drive de la empresa).
- Si el Storage pasa del tope (`BACKUP_MAX_GB`), el trabajo **falla a propósito** (respaldo incompleto) en lugar de decir que salió bien: sube el tope o excluye buckets con `BACKUP_BUCKETS`.
- Un fallo del trabajo te llega como el aviso normal de GitHub por correo; revisa que las notificaciones de Actions estén activas en tu cuenta.
- Contiene datos personales sensibles (INE, CURP): el cifrado protege el archivo, no a quien conozca la frase. Compártela solo con quien deba restaurar.
- El respaldo manual del Panel principal (`src/lib/backup.js`) sigue ahí y es independiente.
