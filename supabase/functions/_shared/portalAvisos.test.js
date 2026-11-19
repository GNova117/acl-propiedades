import { describe, expect, it } from "vitest";
import es from "../../../src/i18n/locales/es.json";
import { PORTAL_UPLOADABLE_DOC_TYPES, TRAMITE_STAGE_KEYS, clientTodo, defaultRequestedDocs as appDefaults, portalChecklist, requestedDocsFor as appRequested } from "../../../src/lib/clientPortal.js";
import { DOC_LABELS, PORTAL_DOC_TYPES, STAGES, buildReminderEmail, buildStageEmail, canNotify, defaultRequestedDocs, pendingDocs, portalUrl, requestedDocsFor } from "./portalAvisos.js";

const TOKEN = "a".repeat(32);
const client = { name: "Luis Pérez Gómez", email: "luis@correo.com", type: "comprador", active: true };

describe("portalAvisos: copias que no deben desincronizarse con la app", () => {
  it("mismos tipos de documento y mismas etapas", () => {
    expect(PORTAL_DOC_TYPES).toEqual(PORTAL_UPLOADABLE_DOC_TYPES);
    expect(Object.keys(STAGES)).toEqual(TRAMITE_STAGE_KEYS);
  });

  it("los textos de las etapas y los nombres de documentos son los de es.json", () => {
    for (const key of TRAMITE_STAGE_KEYS) {
      expect(STAGES[key]).toEqual({ title: es.portal.tramite.stages[key].title, body: es.portal.tramite.stages[key].body });
    }
    for (const docType of PORTAL_UPLOADABLE_DOC_TYPES) expect(DOC_LABELS[docType]).toBe(es.documentCapture.docTypes[docType]);
  });

  it("documentos pedidos por omisión y los que guardó el asesor, igual que en la app", () => {
    for (const type of ["comprador", "vendedor", "ambos", "otro", undefined]) expect(defaultRequestedDocs(type)).toEqual(appDefaults(type));
    for (const tramite of [null, { requested_docs: [] }, { requested_docs: ["luz", "ine", "inventado"] }]) {
      expect(requestedDocsFor(tramite, "comprador")).toEqual(appRequested(tramite, "comprador"));
    }
  });

  it("los pendientes salen en el mismo orden y estado que la lista del cliente", () => {
    const status = {
      client_type: "vendedor",
      tramite: { requested_docs: ["ine", "curp", "acta_nacimiento", "cedula_fiscal", "predial"] },
      documents: [
        { doc_type: "ine", review_status: "valido", captured_at: "2026-11-01T10:00:00Z" },
        { doc_type: "curp", review_status: "rechazado", captured_at: "2026-11-02T10:00:00Z" },
        { doc_type: "acta_nacimiento", review_status: "pendiente", captured_at: "2026-11-02T11:00:00Z" },
      ],
      office_documents: [{ doc_type: "cedula_fiscal", captured_at: "2026-11-03T10:00:00Z" }],
    };
    const fromApp = clientTodo(portalChecklist(appRequested(status.tramite, status.client_type), status.documents, status.office_documents)).map((i) => ({ docType: i.docType, state: i.state }));
    expect(pendingDocs(status)).toEqual(fromApp);
    expect(pendingDocs(status)).toEqual([
      { docType: "curp", state: "corregir" },
      { docType: "predial", state: "pendiente" },
    ]);
  });

  it("un documento que entregó en la oficina después de subirlo al portal cuenta como recibido (y al revés)", () => {
    const base = { client_type: "comprador", tramite: { requested_docs: ["ine"] } };
    expect(pendingDocs({ ...base, documents: [{ doc_type: "ine", review_status: "rechazado", captured_at: "2026-11-01T00:00:00Z" }], office_documents: [{ doc_type: "ine", captured_at: "2026-11-05T00:00:00Z" }] })).toEqual([]);
    expect(pendingDocs({ ...base, documents: [{ doc_type: "ine", review_status: "rechazado", captured_at: "2026-11-06T00:00:00Z" }], office_documents: [{ doc_type: "ine", captured_at: "2026-11-05T00:00:00Z" }] })).toEqual([{ docType: "ine", state: "corregir" }]);
  });
});

describe("quién puede recibir avisos", () => {
  it("necesita correo válido, cliente activo y enlace vigente", () => {
    expect(canNotify(client, TOKEN)).toBe(true);
    expect(canNotify(client, null)).toBe(false);
    expect(canNotify({ ...client, email: "" }, TOKEN)).toBe(false);
    expect(canNotify({ ...client, email: "no-es-correo" }, TOKEN)).toBe(false);
    expect(canNotify({ ...client, active: false }, TOKEN)).toBe(false);
    expect(canNotify(null, TOKEN)).toBe(false);
  });
});

describe("correos", () => {
  it("etapa: título, mensaje del asesor escapado y enlace al portal; solo el primer nombre", () => {
    const email = buildStageEmail({ client, tramite: { stage: "avaluo", note: "Ya agendamos el <b>avalúo</b> para el jueves" }, token: TOKEN, siteUrl: "https://acl.test" });
    expect(email.subject).toBe("Tu trámite avanzó: Avalúo");
    expect(email.html).toContain("Hola, Luis.");
    expect(email.html).not.toContain("Pérez");
    expect(email.html).toContain("Ya agendamos el &lt;b&gt;avalúo&lt;/b&gt; para el jueves");
    expect(email.html).not.toContain("<b>avalúo</b>");
    expect(email.html).toContain(portalUrl("https://acl.test", TOKEN));
    expect(email.text).toContain(`Ver cómo va mi trámite: https://acl.test/documentos/${TOKEN}`);
    // En texto plano el mensaje va tal como lo escribió el asesor (sin entidades HTML).
    expect(email.text).toContain("Mensaje de tu asesor: Ya agendamos el <b>avalúo</b> para el jueves");
    expect(email.text).not.toContain("&lt;");
  });

  it("etapa: una etapa desconocida lanza (no se manda un correo roto)", () => {
    expect(() => buildStageEmail({ client, tramite: { stage: "inventada" }, token: TOKEN })).toThrow(/Etapa desconocida/);
  });

  it("recordatorio: singular/plural, marca lo que hay que volver a subir y no filtra datos del cliente", () => {
    const one = buildReminderEmail({ client, pending: [{ docType: "ine", state: "pendiente" }], token: TOKEN, siteUrl: "https://acl.test" });
    expect(one.subject).toBe("Te falta 1 documento para avanzar con tu trámite");
    const two = buildReminderEmail({ client, pending: [{ docType: "curp", state: "corregir" }, { docType: "predial", state: "pendiente" }], token: TOKEN, siteUrl: "https://acl.test" });
    expect(two.subject).toBe("Te faltan 2 documentos para avanzar con tu trámite");
    expect(two.html).toContain("CURP (hay que volver a subirlo)");
    expect(two.html).toContain("Predial");
    expect(two.html).toContain("tu asesor te dejó una observación");
    expect(two.text).toContain(`Subir mis documentos: https://acl.test/documentos/${TOKEN}`);
    expect(two.html).not.toContain("luis@correo.com");
  });
});
