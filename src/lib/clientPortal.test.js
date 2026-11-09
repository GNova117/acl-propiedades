import { describe, expect, it } from "vitest";
import {
  PORTAL_UPLOADABLE_DOC_TYPES,
  checklistSummary,
  clientTodo,
  defaultRequestedDocs,
  portalAcceptsImage,
  portalChecklist,
  requestedDocsFor,
  tramiteFlowFor,
  tramiteStagesFor,
  tramiteSteps,
  TRAMITE_STAGE_KEYS,
} from "./clientPortal";

const portalDoc = (docType, reviewStatus, capturedAt = "2026-11-01T10:00:00Z", extra = {}) => ({
  id: `${docType}-${capturedAt}`,
  doc_type: docType,
  file_kind: "document",
  source: "client_portal",
  review_status: reviewStatus,
  captured_at: capturedAt,
  ...extra,
});

describe("documentos que se le piden al cliente", () => {
  it("a un comprador le pide identificación, CURP, acta y constancia", () => {
    expect(defaultRequestedDocs("comprador")).toEqual(["ine", "curp", "acta_nacimiento", "cedula_fiscal"]);
  });

  it("a un vendedor además le pide los papeles del inmueble", () => {
    expect(defaultRequestedDocs("vendedor")).toEqual(expect.arrayContaining(["escrituras", "predial", "agua", "luz"]));
  });

  it("«ambos» junta las dos listas sin repetir y en el orden de siempre", () => {
    const docs = defaultRequestedDocs("ambos");
    expect(new Set(docs).size).toBe(docs.length);
    expect(docs).toEqual(PORTAL_UPLOADABLE_DOC_TYPES.filter((d) => docs.includes(d)));
  });

  it("usa lo que marcó el asesor, ordenado y sin tipos que el portal no admite", () => {
    expect(requestedDocsFor({ requested_docs: ["luz", "contrato", "ine"] }, "comprador")).toEqual(["ine", "luz"]);
  });

  it("sin nada guardado (o lista vacía) vuelve a la lista por omisión", () => {
    expect(requestedDocsFor(null, "vendedor")).toEqual(defaultRequestedDocs("vendedor"));
    expect(requestedDocsFor({ requested_docs: [] }, "comprador")).toEqual(defaultRequestedDocs("comprador"));
  });

  it("solo la constancia y el acta exigen PDF; lo demás admite foto", () => {
    expect(portalAcceptsImage("cedula_fiscal")).toBe(false);
    expect(portalAcceptsImage("acta_nacimiento")).toBe(false);
    expect(portalAcceptsImage("ine")).toBe(true);
    expect(portalAcceptsImage("predial")).toBe(true);
  });
});

describe("lista de pendientes", () => {
  const requested = ["ine", "curp", "acta_nacimiento", "cedula_fiscal"];

  it("marca cada documento según lo que subió y lo que revisó el asesor", () => {
    const items = portalChecklist(requested, [
      portalDoc("ine", "valido"),
      portalDoc("curp", "rechazado", "2026-11-01T10:00:00Z", { review_notes: "Se ve borrosa" }),
      portalDoc("cedula_fiscal", "requiere_revision"),
    ]);
    expect(items.map((i) => [i.docType, i.state])).toEqual([
      ["ine", "aprobado"],
      ["curp", "corregir"],
      ["acta_nacimiento", "pendiente"],
      ["cedula_fiscal", "en_revision"],
    ]);
  });

  it("un documento entregado en la oficina cuenta como recibido", () => {
    const items = portalChecklist(requested, [], [{ doc_type: "acta_nacimiento", captured_at: "2026-10-20T10:00:00Z" }]);
    expect(items.find((i) => i.docType === "acta_nacimiento").state).toBe("recibido");
  });

  it("manda el más reciente entre el del portal y el de la oficina", () => {
    const office = [{ doc_type: "ine", captured_at: "2026-11-05T10:00:00Z" }];
    const rejectedBefore = portalChecklist(["ine"], [portalDoc("ine", "rechazado", "2026-11-01T10:00:00Z")], office);
    expect(rejectedBefore[0].state).toBe("recibido");
    const uploadedAfter = portalChecklist(["ine"], [portalDoc("ine", "pendiente", "2026-11-08T10:00:00Z")], office);
    expect(uploadedAfter[0].state).toBe("en_revision");
  });

  it("de varias subidas del mismo documento toma la última", () => {
    const items = portalChecklist(["ine"], [portalDoc("ine", "rechazado", "2026-11-01T10:00:00Z"), portalDoc("ine", "pendiente", "2026-11-02T10:00:00Z")]);
    expect(items[0].state).toBe("en_revision");
  });

  it("la foto de respaldo no cuenta como el documento", () => {
    const items = portalChecklist(["ine"], [{ ...portalDoc("ine", "pendiente"), file_kind: "backup_image" }]);
    expect(items[0].state).toBe("pendiente");
  });

  it("resume cuántos están listos, en revisión y por hacer", () => {
    const items = portalChecklist(
      requested,
      [portalDoc("ine", "valido"), portalDoc("curp", "rechazado"), portalDoc("cedula_fiscal", "pendiente")],
      [{ doc_type: "acta_nacimiento", captured_at: "2026-10-01T10:00:00Z" }]
    );
    expect(checklistSummary(items)).toEqual({ total: 4, done: 2, inReview: 1, todo: 1 });
  });

  it("lo que le toca al cliente pone primero lo que hay que corregir", () => {
    const items = portalChecklist(requested, [portalDoc("acta_nacimiento", "rechazado")]);
    expect(clientTodo(items).map((i) => i.docType)).toEqual(["acta_nacimiento", "ine", "curp", "cedula_fiscal"]);
  });
});

describe("estatus del trámite", () => {
  it("elige el flujo según el tipo de cliente y cómo compra", () => {
    expect(tramiteFlowFor({ type: "vendedor" })).toBe("venta");
    expect(tramiteFlowFor({ type: "comprador", financiamiento: "contado" })).toBe("compra_contado");
    expect(tramiteFlowFor({ type: "comprador", financiamiento: "infonavit" })).toBe("compra_credito");
    expect(tramiteFlowFor({ type: "comprador" })).toBe("compra_credito");
    expect(tramiteFlowFor({ type: "ambos" })).toBe("venta");
    expect(tramiteFlowFor({ type: "ambos", financiamiento: "bancario" })).toBe("compra_credito");
  });

  it("de contado no pasa por avalúo ni crédito", () => {
    const stages = tramiteStagesFor({ type: "comprador", financiamiento: "contado" });
    expect(stages).not.toContain("avaluo");
    expect(stages).not.toContain("credito");
    expect(stages[0]).toBe("documentos");
    expect(stages.at(-1)).toBe("entrega");
  });

  it("todas las etapas de todos los flujos son claves conocidas (las del check en SQL)", () => {
    for (const client of [{ type: "vendedor" }, { type: "comprador", financiamiento: "contado" }, { type: "comprador" }]) {
      for (const stage of tramiteStagesFor(client)) expect(TRAMITE_STAGE_KEYS).toContain(stage);
    }
  });

  it("marca las etapas hechas, la actual y las siguientes", () => {
    const stages = ["documentos", "revision", "avaluo", "credito"];
    expect(tramiteSteps(stages, "avaluo").map((s) => s.status)).toEqual(["hecha", "hecha", "actual", "siguiente"]);
  });

  it("sin etapa, o con una que no es de este flujo, arranca en la primera", () => {
    const stages = ["documentos", "revision", "firma"];
    expect(tramiteSteps(stages, undefined)[0].status).toBe("actual");
    expect(tramiteSteps(stages, "promocion")[0].status).toBe("actual");
  });
});
