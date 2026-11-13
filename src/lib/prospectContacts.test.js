import { describe, expect, it } from "vitest";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, FOLLOWUP_KEEP, FOLLOWUP_NONE, advancedStage, contactUpdate, followupArg, outcomeValues, validateContact } from "./prospectContacts";
import { addDaysISO, todayISO } from "./prospects";

describe("followupArg", () => {
  it("una fecha se manda tal cual", () => {
    expect(followupArg("2026-11-02")).toBe("2026-11-02");
  });

  it("'sin fecha' es null: borra el seguimiento", () => {
    expect(followupArg(FOLLOWUP_NONE)).toBeNull();
  });

  it("'dejar la fecha' o sin elegir es undefined: contactFields no toca una fecha futura", () => {
    expect(followupArg(FOLLOWUP_KEEP)).toBeUndefined();
    expect(followupArg("")).toBeUndefined();
  });
});

describe("validateContact", () => {
  it("exige un canal válido", () => {
    expect(validateContact({ channel: "" }).channel).toBe("prospects.contact.errors.channel");
    expect(validateContact({ channel: "paloma" }).channel).toBe("prospects.contact.errors.channel");
    for (const channel of CONTACT_CHANNELS) expect(validateContact({ channel })).toEqual({});
  });

  it("en etapa abierta pide elegir el seguimiento; en cerrada/perdida no", () => {
    expect(validateContact({ channel: "llamada", askFollowup: true }).followup).toBe("prospects.contact.errors.followup");
    expect(validateContact({ channel: "llamada", askFollowup: false })).toEqual({});
  });

  it("acepta una fecha, 'dejar la que tiene' o 'sin fecha' como elección", () => {
    for (const followup of [addDaysISO(3), FOLLOWUP_KEEP, FOLLOWUP_NONE, todayISO()]) {
      expect(validateContact({ channel: "llamada", followup, askFollowup: true })).toEqual({});
    }
  });

  it("rechaza una fecha de seguimiento en el pasado", () => {
    expect(validateContact({ channel: "llamada", followup: addDaysISO(-1), askFollowup: true }).followup).toBe("prospects.contact.errors.pastDate");
  });
});

describe("resultados de un toque", () => {
  const now = new Date(2026, 10, 12, 10, 0); // 12 de noviembre de 2026
  const outcome = (key) => CONTACT_OUTCOMES.find((o) => o.key === key);

  it("«No contestó» registra una llamada y deja el seguimiento para mañana", () => {
    expect(outcomeValues(outcome("noAnswer"), { note: "No contestó", now })).toEqual({
      channel: "llamada",
      note: "No contestó",
      nextFollowup: "2026-11-13",
      stage: undefined,
    });
  });

  it("respeta el canal que ya se había elegido (p. ej. WhatsApp tras mandar un mensaje)", () => {
    expect(outcomeValues(outcome("noAnswer"), { channel: "whatsapp", note: "x", now }).channel).toBe("whatsapp");
  });

  it("un canal que no existe se ignora y se usa el del resultado", () => {
    expect(outcomeValues(outcome("callLater"), { channel: "paloma", note: "x", now }).channel).toBe("llamada");
  });

  it("«Interesado» programa el seguimiento en 3 días y pide avanzar a «interesado»", () => {
    expect(outcomeValues(outcome("interested"), { note: "Interesado", now })).toMatchObject({ nextFollowup: "2026-11-15", stage: "interesado" });
  });

  it("todos los resultados dan una fecha futura válida para validateContact", () => {
    for (const o of CONTACT_OUTCOMES) {
      const values = outcomeValues(o, { note: "x" });
      expect(validateContact({ channel: values.channel, followup: values.nextFollowup, askFollowup: true })).toEqual({});
    }
  });
});

describe("advancedStage", () => {
  it("avanza solo hacia adelante", () => {
    expect(advancedStage("nuevo", "interesado")).toBe("interesado");
    expect(advancedStage("contactado", "interesado")).toBe("interesado");
  });

  it("no retrocede ni repite la etapa", () => {
    expect(advancedStage("interesado", "interesado")).toBeUndefined();
    expect(advancedStage("negociacion", "interesado")).toBeUndefined();
  });

  it("no toca prospectos cerrados o perdidos, ni sin etapa destino", () => {
    expect(advancedStage("cerrado", "interesado")).toBeUndefined();
    expect(advancedStage("perdido", "interesado")).toBeUndefined();
    expect(advancedStage("nuevo", undefined)).toBeUndefined();
  });
});

describe("contactUpdate", () => {
  const now = new Date(2026, 10, 12, 10, 0);

  it("un contacto cualquiera pasa «nuevo» a «contactado» y guarda el último contacto y el seguimiento", () => {
    const fields = contactUpdate({ stage: "nuevo" }, { nextFollowup: "2026-11-13", now });
    expect(fields).toMatchObject({ stage: "contactado", next_followup_at: "2026-11-13" });
    expect(fields.last_contact_at).toBe(now.toISOString());
  });

  it("«Interesado» desde «nuevo» llega hasta «interesado» (no se queda en «contactado»)", () => {
    expect(contactUpdate({ stage: "nuevo" }, { nextFollowup: "2026-11-15", stage: "interesado", now }).stage).toBe("interesado");
  });

  it("«Interesado» no retrocede a quien ya está más adelante", () => {
    expect(contactUpdate({ stage: "negociacion" }, { nextFollowup: "2026-11-15", stage: "interesado", now })).not.toHaveProperty("stage");
  });
});
