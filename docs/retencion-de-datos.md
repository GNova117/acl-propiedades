# Plazos de conservación de datos personales

Decididos por el dueño. Cada día a las 07:30 UTC corre `depurar_datos()` (pg_cron, migración 0127) y lo registra en `datos_purge_log`.

| Datos | Plazo | Dónde vive | Desde cuándo se cuenta |
|---|---|---|---|
| Chats | 1 semana | `chat_rate_limits` (sesión y huella de la IP; el texto de la conversación **no** se guarda) | Fecha de la consulta |
| Mensajes de contacto | 1 semana | `contact_messages` | Fecha del mensaje (atendido o no) |
| Prospectos | 1 mes | `prospectos` (con sus etapas y contactos) | **Última actividad**: alta, edición, contacto o cambio de etapa. Si tiene un seguimiento programado a futuro, no vence hasta que esa fecha pase |
| Contratos | 6 meses | `signing_requests` (documento enviado a firma, firma, IP, huella) | Lo más reciente entre creado, firmado o sellado |
| Papelería de clientes | 3 años | `client_documents`, `agenda_expedientes` (ver 0123) | Última actividad con el cliente |

## Cómo se activa

- **Chats**: se borran desde el primer día (es bitácora de límites de uso).
- **Mensajes, prospectos y contratos arrancan en SIMULACRO**: la corrida cuenta y registra lo que borraría, sin borrar. En **Roles y accesos → Depuración de datos personales** se ve cuántos ya vencieron; cuando la cifra es la esperada se pulsa «Activar borrado» en esa regla (se puede volver a simulacro).
- La papelería de clientes sigue con su propio simulacro (`RETENTION_PURGE_ENABLED`, ver `docs/auditoria-seguridad-101-121.md`).
- Aplicar la migración **0127** (`npm run db:migrate` o SQL Editor; es re-ejecutable).

## Qué hay que saber antes de activar

- **Prospectos a 1 mes**: un prospecto sin movimiento en un mes desaparece con sus etapas y contactos, aunque esté en negociación. Conviene registrar un seguimiento a futuro en los que sigan vivos. Quien ya se volvió cliente conserva su ficha de cliente (3 años).
- **Contratos a 6 meses**: se interpretó «contratos» como los documentos enviados a firma (`signing_requests`). Pasados 6 meses se pierde la evidencia de firma (firma, IP, huella) que está en el sistema; el cliente conserva su copia. Si «contratos» se refería a otra cosa (p. ej. las exclusivas de propiedades), hay que avisar.
- **Mensajes a 1 semana**: se borran aunque nadie los haya atendido. Se pierde también el vínculo mensaje → prospecto.
- Las **citas y visitas** conservan nombre y teléfono de contacto: para quitar los de una persona está la herramienta de Derechos ARCO (`/admin/arco`).
- El nombre se quita también del registro de actividad (`audit_log`) de lo que se borra.
- El aviso de privacidad ya dice estos plazos (requiere revisión legal).
