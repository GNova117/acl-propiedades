import { describe, expect, it, vi } from "vitest";
import { handlePortalAvisos } from "./handler.js";

const TOKEN = "b".repeat(32);
const client = { id: "c1", name: "Ana López", email: "ana@correo.com", type: "comprador", active: true };
const tramite = { client_id: "c1", stage: "revision", note: null, requested_docs: ["ine", "curp"], notify_client: true };

function deps(over = {}) {
  return {
    siteUrl: "https://acl.test",
    loadNotice: vi.fn(async () => ({ tramite, client, token: TOKEN })),
    claimStageNotice: vi.fn(async () => true),
    listReminderCandidates: vi.fn(async () => [{ client_id: "c1" }]),
    loadPortalStatus: vi.fn(async () => ({ status: "activo", client_type: "comprador", tramite, documents: [], office_documents: [] })),
    claimReminder: vi.fn(async () => ({ claimed: true, prev_at: null, prev_count: 0 })),
    releaseReminder: vi.fn(async () => {}),
    sendEmail: vi.fn(async () => ({ id: "ok" })),
    ...over,
  };
}

describe("portal-avisos: cambio de etapa", () => {
  it("manda el correo de la etapa a quien lo tiene activado", async () => {
    const d = deps();
    const res = await handlePortalAvisos({ kind: "etapa", client_id: "c1" }, d);
    expect(res).toEqual({ status: 200, body: { sent: 1 } });
    expect(d.claimStageNotice).toHaveBeenCalledWith("c1", "revision");
    const message = d.sendEmail.mock.calls[0][0];
    expect(message.to).toBe("ana@correo.com");
    expect(message.subject).toBe("Tu trámite avanzó: Revisión");
    expect(message.html).toContain(`https://acl.test/documentos/${TOKEN}`);
  });

  it("no manda nada si el asesor no activó los avisos, o sin correo o sin enlace vigente", async () => {
    for (const notice of [
      { tramite: { ...tramite, notify_client: false }, client, token: TOKEN },
      { tramite, client: { ...client, email: "" }, token: TOKEN },
      { tramite, client, token: null },
      null,
    ]) {
      const d = deps({ loadNotice: vi.fn(async () => notice) });
      const res = await handlePortalAvisos({ kind: "etapa", client_id: "c1" }, d);
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBeTruthy();
      expect(d.sendEmail).not.toHaveBeenCalled();
    }
  });

  it("un aviso ya reclamado no se manda otra vez", async () => {
    const d = deps({ claimStageNotice: vi.fn(async () => false) });
    expect((await handlePortalAvisos({ kind: "etapa", client_id: "c1" }, d)).body).toEqual({ skipped: "ya avisada" });
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("si el envío falla responde 500 (el reclamo de la etapa ya quedó: se reintenta cambiando de etapa)", async () => {
    const d = deps({ sendEmail: vi.fn(async () => { throw new Error("Resend: caído"); }) });
    const res = await handlePortalAvisos({ kind: "etapa", client_id: "c1" }, d);
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Resend");
  });

  it("pide el cliente", async () => {
    expect((await handlePortalAvisos({ kind: "etapa" }, deps())).status).toBe(400);
  });
});

describe("portal-avisos: recordatorios", () => {
  it("manda uno por cliente con pendientes", async () => {
    const d = deps();
    const res = await handlePortalAvisos({ kind: "recordatorios" }, d);
    expect(res.body.sent).toBe(1);
    expect(res.body.results.c1).toBe("enviado");
    expect(d.sendEmail.mock.calls[0][0].subject).toBe("Te faltan 2 documentos para avanzar con tu trámite");
  });

  it("sin pendientes, sin enlace vigente o con recordatorios agotados no manda ni reclama de más", async () => {
    const noPending = deps({ loadPortalStatus: vi.fn(async () => ({ status: "activo", client_type: "comprador", tramite: { requested_docs: ["ine"] }, documents: [{ doc_type: "ine", review_status: "valido", captured_at: "2026-11-01" }], office_documents: [] })) });
    expect((await handlePortalAvisos({ kind: "recordatorios" }, noPending)).body.results.c1).toBe("sin pendientes");
    expect(noPending.claimReminder).not.toHaveBeenCalled();

    const expired = deps({ loadPortalStatus: vi.fn(async () => ({ status: "expirado" })) });
    expect((await handlePortalAvisos({ kind: "recordatorios" }, expired)).body.results.c1).toBe("enlace no vigente");

    const exhausted = deps({ claimReminder: vi.fn(async () => ({ claimed: false })) });
    const res = await handlePortalAvisos({ kind: "recordatorios" }, exhausted);
    expect(res.body.sent).toBe(0);
    expect(exhausted.sendEmail).not.toHaveBeenCalled();
  });

  it("si el envío falla, libera el reclamo para reintentar y sigue con los demás", async () => {
    const claim = { claimed: true, prev_at: "2026-11-01T00:00:00Z", prev_count: 1 };
    const d = deps({
      listReminderCandidates: vi.fn(async () => [{ client_id: "c1" }, { client_id: "c2" }]),
      claimReminder: vi.fn(async () => claim),
      sendEmail: vi.fn().mockRejectedValueOnce(new Error("Resend: caído")).mockResolvedValueOnce({ id: "ok" }),
    });
    const res = await handlePortalAvisos({ kind: "recordatorios" }, d);
    expect(res.body.sent).toBe(1);
    expect(res.body.results.c1).toContain("error: Resend");
    expect(d.releaseReminder).toHaveBeenCalledTimes(1);
    expect(d.releaseReminder).toHaveBeenCalledWith("c1", claim);
    expect(res.body.results.c2).toBe("enviado");
  });

  it("un kind desconocido es un error", async () => {
    expect((await handlePortalAvisos({ kind: "x" }, deps())).status).toBe(400);
    expect((await handlePortalAvisos(null, deps())).status).toBe(400);
  });
});
