// Función serverless del portal de documentos (/documentos/<token>): el
// cliente nunca tiene sesión de Supabase, así que esta es la ÚNICA pieza del
// módulo que usa SUPABASE_SERVICE_ROLE_KEY (igual que ya hacen las Edge
// Functions de Agenda con esa misma llave, ver supabase/functions/) — solo
// para lo que de verdad lo necesita: validar el token, contar intentos,
// subir el archivo a Storage e insertar la fila. TODO lo que se puede
// validar sin privilegios (formato del token, tipo real del archivo,
// tamaño) se revisa ANTES de tocar la base o Storage.
//
// Qué NO hace esta función: nunca marca un documento como "rechazado" por sí
// sola (el estado automático solo sugiere 'valido' o 'requiere_revision';
// rechazar siempre lo decide una persona en /admin/clientes/:id/documentos),
// y nunca pide ni toca credenciales del SAT/gob.mx — el cliente ya descargó
// el PDF él mismo antes de llegar aquí.
import { createClient } from "@supabase/supabase-js";
import { isAllowedDocumentFile, isAllowedBackupImageFile, detectFileType } from "../server/documentValidation/fileSignature.js";
import { DocumentValidationError } from "../server/documentValidation/index.js";
import { getDocumentProvider } from "../server/documentProviders/index.js";

const TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const DOC_TYPES = new Set(["cedula_fiscal", "acta_nacimiento"]);
const FILE_KINDS = new Set(["document", "backup_image"]);

// Topes deliberadamente bajos: una Constancia de Situación Fiscal o un acta
// digital pesan unos cientos de KB. El límite real importante es el del
// cuerpo de la petición en Vercel (Node.js runtime, ~4.5 MB) — base64 infla
// ~33%, así que 3 MB crudos (~4 MB en base64) se queda con margen. Pendiente
// confirmar contra el plan de Vercel real antes de producción.
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
const MAX_BACKUP_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_BACKUP_IMAGE_BYTES * 4) / 3) + 1000;

// Intentos de subida por token en la última hora, contra abuso/fuerza bruta
// del enlace. Ajustar aquí si el negocio lo necesita (no hay variable de
// entorno para esto a propósito: es un límite de seguridad, no de costo).
const HOURLY_UPLOAD_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;

const EXT_BY_TYPE = { pdf: "pdf", jpeg: "jpg", png: "png" };

function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body && typeof req.body === "object" ? req.body : null;
}

function validateParams(body) {
  const token = String(body?.token ?? "");
  const docType = String(body?.docType ?? "");
  const fileKind = String(body?.fileKind ?? "document");
  const fileBase64 = String(body?.fileBase64 ?? "");
  if (!TOKEN_PATTERN.test(token)) return null;
  if (!DOC_TYPES.has(docType)) return null;
  if (!FILE_KINDS.has(fileKind)) return null;
  if (fileBase64.length < 100 || fileBase64.length > MAX_BASE64_CHARS) return null;
  return { token, docType, fileKind, fileBase64 };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method" });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Modo demo / Supabase no configurado: el portal no está disponible.
    res.status(503).json({ error: "not_configured" });
    return;
  }

  const params = validateParams(parseBody(req));
  if (!params) {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const { token, docType, fileKind, fileBase64 } = params;

  let buffer;
  try {
    buffer = Buffer.from(fileBase64, "base64");
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const maxBytes = fileKind === "backup_image" ? MAX_BACKUP_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (buffer.length < 10 || buffer.length > maxBytes) {
    res.status(413).json({ error: "file_too_large", max_bytes: maxBytes });
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: tokenRow, error: tokenError } = await supabase
    .from("client_portal_tokens")
    .select("id, client_id, active, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (tokenError) {
    res.status(500).json({ error: "server_error" });
    return;
  }
  if (!tokenRow) {
    res.status(404).json({ error: "invalid_token" });
    return;
  }
  if (!tokenRow.active) {
    res.status(410).json({ error: "revoked_token" });
    return;
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: "expired_token" });
    return;
  }

  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count: attemptCount, error: attemptsError } = await supabase
    .from("portal_upload_attempts")
    .select("id", { count: "exact", head: true })
    .eq("token_id", tokenRow.id)
    .gte("created_at", since);
  if (attemptsError) {
    res.status(500).json({ error: "server_error" });
    return;
  }
  if ((attemptCount ?? 0) >= HOURLY_UPLOAD_LIMIT) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  // Se cuenta el intento aunque el archivo resulte inválido más abajo: es
  // justo lo que este límite debe frenar.
  await supabase.from("portal_upload_attempts").insert({ token_id: tokenRow.id });

  const detectedType = detectFileType(buffer);
  const validType = fileKind === "backup_image" ? isAllowedBackupImageFile(buffer) : isAllowedDocumentFile(buffer);
  if (!validType) {
    res.status(422).json({ error: "invalid_file_type", detected: detectedType });
    return;
  }

  const ext = EXT_BY_TYPE[detectedType] || "bin";
  const path = `${tokenRow.client_id}/${docType}-portal-${fileKind}-${Date.now()}.${ext}`;
  const contentType = detectedType === "pdf" ? "application/pdf" : `image/${detectedType}`;

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(path, buffer, { contentType, upsert: false });
  if (uploadError) {
    res.status(500).json({ error: "upload_failed" });
    return;
  }

  let extractedData = {};
  let qrValidated = null;
  let reviewStatus = "pendiente";

  if (fileKind === "document") {
    try {
      const provider = await getDocumentProvider();
      const maxAgeMonths = Number(process.env.CSF_MAX_AGE_MONTHS) || 3;
      const result =
        docType === "cedula_fiscal"
          ? await provider.validateCedulaFiscal(buffer, { maxAgeMonths })
          : await provider.validateActaNacimiento(buffer);
      extractedData = result.extractedData;
      qrValidated = result.qrValidated;
      reviewStatus = result.suggestedStatus;
    } catch (err) {
      if (err instanceof DocumentValidationError && err.code === "suspicious_pdf") {
        await supabase.storage.from("client-documents").remove([path]);
        res.status(422).json({ error: "suspicious_pdf" });
        return;
      }
      // Un fallo inesperado de lectura (PDF raro, librería, etc.) no debe
      // tumbar la subida: el documento queda guardado para revisión manual.
      console.error("document_validation_failed", docType, err?.message);
      extractedData = {};
      qrValidated = null;
      reviewStatus = "requiere_revision";
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("client_documents")
    .insert({
      client_id: tokenRow.client_id,
      doc_type: docType,
      file_path: path,
      source: "client_portal",
      file_kind: fileKind,
      quality_metrics: {},
      extracted_data: extractedData,
      qr_validated: qrValidated,
      review_status: reviewStatus,
      client_confirmed: false,
    })
    .select("id, doc_type, file_kind, extracted_data, qr_validated, review_status, client_confirmed, captured_at")
    .single();

  if (insertError) {
    await supabase.storage.from("client-documents").remove([path]);
    res.status(500).json({ error: "server_error" });
    return;
  }

  await Promise.all([
    supabase.from("document_access_log").insert({
      client_document_id: inserted.id,
      client_id: tokenRow.client_id,
      actor_type: "client",
      action: "upload",
    }),
    supabase.from("client_portal_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", tokenRow.id),
  ]);

  res.status(200).json({ ok: true, document: inserted });
}
