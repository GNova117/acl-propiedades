# Dependencias solo de servidor

Estas tres viven en `dependencies` de `package.json` porque las funciones de Vercel (`api/`, `server/`) las necesitan en producción, pero **nunca deben importarse desde `src/`** (el navegador). Una prueba (`src/serverDependencies.test.js`) falla si alguien lo hace.

| Paquete | Quién lo usa | Para qué |
|---|---|---|
| `@anthropic-ai/sdk` | `server/chatbot.js`, `server/adCopy.js`, `server/marketSearch.js`, `server/sketchToPlan.js` | Chat del sitio, generador de anuncios, búsqueda de mercado y planos desde croquis |
| `@napi-rs/canvas` | `server/ogImage.js`, `server/vercelOg.js`, `server/documentValidation/qrDecode.js`, `scripts/build-og-image.mjs` | Imágenes de vista previa (Open Graph) y lectura de códigos QR en documentos |
| `google-auth-library` | `api/analytics-summary.js` | Consultar Google Analytics desde el servidor |

## ¿Sigue usándose `@napi-rs/canvas`? (punto 491)

Sí: lo usan las imágenes de vista previa y la validación de QR (arriba). Es un binario nativo pesado para funciones serverless; si en algún momento las vistas previas se generan de otra forma (p. ej. una imagen fija por propiedad), se puede quitar. Mientras tanto queda confinado a esas funciones.
