import { describe, expect, it } from "vitest";
import { CONTACT_CHANNELS, FOLLOWUP_PRESET_DAYS, addDaysISO, contactUpdateFields, validateContact } from "./prospectContacts";
import { todayISO } from "./prospects";

describe("addDaysISO", () => {
  it("suma días de calendario y cruza el cambio de mes", () => {
    expect(addDaysISO(0, new Date(2026, 9, 19))).toBe("2026-10-19");
    expect(addDaysISO(3, new Date(2026, 9, 30))).toBe("2026-11-02");
  });

  it("los atajos de seguimiento son mañana, 3 días y una semana", () => {
    expect(FOLLOWUP_PRESET_DAYS).toEqual([1, 3, 7]);
  });
});

describe("contactUpdateFields", () => {
  const now = new Date("2026-10-19T18:00:00Z");
  const yesterday = addDaysISO(-1);
  const nextWeek = addDaysISO(7);

  it("guarda el último contacto y pasa un prospecto 'nuevo' a 'contactado'", () => {
    expect(contactUpdateFields({ stage: "nuevo" }, { now })).toEqual({ last_contact_at: now.toISOString(), stage: "contactado" });
  });

  it("no cambia la etapa de un prospecto que ya avanzó", () => {
    for (const stage of ["contactado", "interesado", "negociacion", "cerrado", "perdido"]) {
      expect(contactUpdateFields({ stage }, { now })).not.toHaveProperty("stage");
    }
  });

  it("una fecha nueva reemplaza el seguimiento anterior", () => {
    const fields = contactUpdateFields({ stage: "interesado", next_followup_at: yesterday }, { nextFollowupAt: nextWeek, now });
    expect(fields.next_followup_at).toBe(nextWeek);
  });

  it("sin fecha nueva, un seguimiento vencido o de hoy se da por atendido", () => {
    expect(contactUpdateFields({ stage: "interesado", next_followup_at: yesterday }, { now }).next_followup_at).toBeNull();
    expect(contactUpdateFields({ stage: "interesado", next_followup_at: todayISO() }, { now }).next_followup_at).toBeNull();
  });

  it("sin fecha nueva, un seguimiento futuro se respeta (no aparece en los campos)", () => {
    expect(contactUpdateFields({ stage: "interesado", next_followup_at: nextWeek }, { now })).not.toHaveProperty("next_followup_at");
    expect(contactUpdateFields({ stage: "interesado", next_followup_at: null }, { now })).not.toHaveProperty("next_followup_at");
  });
});

describe("validateContact", () => {
  it("exige un canal válido", () => {
    expect(validateContact({ channel: "" }).channel).toBe("prospects.contact.errors.channel");
    expect(validateContact({ channel: "paloma" }).channel).toBe("prospects.contact.errors.channel");
    for (const channel of CONTACT_CHANNELS) expect(validateContact({ channel })).toEqual({});
  });

  it("rechaza una fecha de seguimiento en el pasado, pero acepta hoy o vacía", () => {
    expect(validateContact({ channel: "llamada", nextFollowupAt: addDaysISO(-1) }).nextFollowupAt).toBe("prospects.contact.errors.pastDate");
    expect(validateContact({ channel: "llamada", nextFollowupAt: todayISO() })).toEqual({});
    expect(validateContact({ channel: "llamada", nextFollowupAt: "" })).toEqual({});
  });
});
