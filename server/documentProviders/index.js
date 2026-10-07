import { localProvider } from "./localProvider.js";

// Capa de adaptador (Módulo D del portal de documentos): por default se usa
// el proveedor local (regex + QR, sin red externa, ver documentValidation/).
// Si algún día se contrata un validador externo de RFC/CURP/actas (PAC,
// servicio de actas, etc.), se agrega su adapter aquí mismo con la MISMA
// forma — validateCedulaFiscal(buffer, opts) / validateActaNacimiento(buffer) —
// y se activa con DOCUMENT_VALIDATION_PROVIDER en Vercel, sin tocar
// api/portal-upload.js. Vacía/ausente o el nombre no existe = desactivada,
// usa el proveedor local.
// Nota para quien agregue un adapter real: Vercel empaqueta cada función
// serverless rastreando sus imports de forma estática — un import()
// totalmente dinámico como el de abajo puede no detectar el archivo nuevo.
// Si el adapter no aparece en producción, agrega un import estático de
// `./<nombre>.js` aquí mismo (aunque no se use directo) para forzar a que
// se incluya en el bundle, o revisa la config de `functions`/`includeFiles`
// en vercel.json.
export async function getDocumentProvider() {
  const name = process.env.DOCUMENT_VALIDATION_PROVIDER;
  if (!name) return localProvider;
  try {
    const mod = await import(`./${name}.js`);
    return mod.default || mod[name] || localProvider;
  } catch (err) {
    console.error("document_provider_not_found", name, err?.message);
    return localProvider;
  }
}
