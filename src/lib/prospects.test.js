import { describe, expect, it } from "vitest";
import {
  FOLLOWUP_OPTIONS,
  addDaysISO,
  contactFields,
  daysSince,
  followUpState,
  messageToProspectFields,
  todayISO,
  toProspectFields,
  validateProspectForm,
  visitToProspectFields,
} from "./prospects";

describe("daysSince", () => {
  it("devuelve null sin fecha o con una fecha inválida", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince("no-es-fecha")).toBeNull();
  });

  it("hoy mismo cuenta como 0 días", () => {
    expect(daysSince(new Date().toISOString())).toBe(0);
  });

  it("cuenta días completos de calendario, no horas", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(daysSince(fiveDaysAgo)).toBe(5);
  });
});

describe("followUpState", () => {
  const now = new Date();
  const addDays = (n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toLocaleDateString("en-CA");

  it("es 'overdue' cuando la fecha de seguimiento ya pasó", () => {
    expect(followUpState({ stage: "nuevo", next_followup_at: addDays(-1) })).toBe("overdue");
  });

  it("es 'today' cuando el seguimiento es justo hoy", () => {
    expect(followUpState({ stage: "nuevo", next_followup_at: todayISO() })).toBe("today");
  });

  it("es null cuando el seguimiento es en el futuro, no tiene fecha, o la etapa ya está cerrada", () => {
    expect(followUpState({ stage: "nuevo", next_followup_at: addDays(1) })).toBeNull();
    expect(followUpState({ stage: "nuevo", next_followup_at: null })).toBeNull();
    expect(followUpState({ stage: "cerrado", next_followup_at: addDays(-1) })).toBeNull();
    expect(followUpState({ stage: "perdido", next_followup_at: addDays(-1) })).toBeNull();
  });
});

describe("visitToProspectFields", () => {
  it("mapea el interés de la visita a una etapa inicial razonable", () => {
    expect(visitToProspectFields({ interest: "muy_interesado" }).stage).toBe("interesado");
    expect(visitToProspectFields({ interest: "oferta_realizada" }).stage).toBe("negociacion");
    // Descartó esa propiedad, pero sigue siendo un posible cliente a contactar.
    expect(visitToProspectFields({ interest: "descartado" }).stage).toBe("contactado");
    expect(visitToProspectFields({ interest: "algo_desconocido" }).stage).toBe("nuevo");
  });

  it("usa 'Sin nombre' si la visita no trae nombre de prospecto", () => {
    expect(visitToProspectFields({ interest: "interesado", prospect_name: "  " }).name).toBe("Sin nombre");
  });

  it("copia las notas internas, nunca el comentario público que ve el vendedor", () => {
    const fields = visitToProspectFields({ interest: "interesado", internal_notes: "cliente difícil", comments: "todo bien" });
    expect(fields.notes).toBe("cliente difícil");
  });
});

describe("messageToProspectFields", () => {
  it("asigna el primer asesor de la propiedad, aunque tenga varios, para que el prospecto no quede sin dueño", () => {
    const withOne = messageToProspectFields({ name: "Ana" }, { advisors: [{ id: "a1" }] });
    expect(withOne.advisor_id).toBe("a1");
    const withTwo = messageToProspectFields({ name: "Ana" }, { advisors: [{ id: "a1" }, { id: "a2" }] });
    expect(withTwo.advisor_id).toBe("a1");
    const withNone = messageToProspectFields({ name: "Ana" }, undefined);
    expect(withNone.advisor_id).toBeNull();
  });

  it("usa el canal del mensaje como fuente si está en la lista reconocida, y 'sitio' si no", () => {
    expect(messageToProspectFields({ name: "Ana", channel: "whatsapp" }, {}).source).toBe("whatsapp");
    expect(messageToProspectFields({ name: "Ana", channel: "formulario" }, {}).source).toBe("sitio");
  });
});

describe("toProspectFields", () => {
  const base = { name: "Ana", phone: "", email: "", source: "manual", stage: "nuevo", advisor_id: "", property_id: "", looking_for: "", notes: "", next_followup_at: "", lost_reason: "" };

  it("convierte campos vacíos a null", () => {
    const fields = toProspectFields(base);
    expect(fields.phone).toBeNull();
    expect(fields.advisor_id).toBeNull();
    expect(fields.next_followup_at).toBeNull();
  });

  it("solo guarda lost_reason cuando la etapa es 'perdido'", () => {
    expect(toProspectFields({ ...base, lost_reason: "muy caro" }).lost_reason).toBeNull();
    expect(toProspectFields({ ...base, stage: "perdido", lost_reason: "muy caro" }).lost_reason).toBe("muy caro");
  });
});

describe("validateProspectForm", () => {
  const valid = { name: "Ana", phone: "8714871494", email: "" };

  it("exige nombre", () => {
    expect(validateProspectForm({ ...valid, name: "" }).name).toBeTruthy();
  });

  it("exige al menos un dato de contacto (teléfono o correo)", () => {
    expect(validateProspectForm({ ...valid, phone: "" }).phone).toBeTruthy();
    expect(validateProspectForm({ ...valid, phone: "", email: "ana@x.com" }).phone).toBeUndefined();
  });

  it("valida el formato del correo solo si se escribió algo", () => {
    expect(validateProspectForm({ ...valid, email: "no-es-correo" }).email).toBeTruthy();
    expect(validateProspectForm(valid).email).toBeUndefined();
  });
});

describe("addDaysISO", () => {
  it("suma días de calendario y devuelve YYYY-MM-DD", () => {
    expect(addDaysISO(1, new Date(2026, 9, 16))).toBe("2026-10-17");
    expect(addDaysISO(14, new Date(2026, 9, 16))).toBe("2026-10-30");
  });

  it("cruza el fin de mes y de año", () => {
    expect(addDaysISO(3, new Date(2026, 9, 30))).toBe("2026-11-02");
    expect(addDaysISO(7, new Date(2026, 11, 28))).toBe("2027-01-04");
  });

  it("sin fecha base cuenta desde hoy", () => {
    expect(addDaysISO(0)).toBe(todayISO());
  });
});

describe("FOLLOWUP_OPTIONS", () => {
  it("ofrece atajos ordenados de menor a mayor y sin repetir claves", () => {
    const days = FOLLOWUP_OPTIONS.map((o) => o.days);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(new Set(FOLLOWUP_OPTIONS.map((o) => o.key)).size).toBe(FOLLOWUP_OPTIONS.length);
  });
});

describe("contactFields", () => {
  const now = new Date("2026-10-16T18:00:00.000Z");
  const tomorrow = addDaysISO(1);

  it("programa el siguiente seguimiento con la fecha elegida", () => {
    const fields = contactFields({ stage: "interesado", next_followup_at: addDaysISO(-2) }, tomorrow, now);
    expect(fields).toEqual({ last_contact_at: now.toISOString(), next_followup_at: tomorrow });
  });

  it("con null deja al prospecto sin fecha de seguimiento, aunque hubiera una futura", () => {
    const fields = contactFields({ stage: "interesado", next_followup_at: addDaysISO(5) }, null, now);
    expect(fields.next_followup_at).toBeNull();
  });

  it("sin elegir (undefined) conserva una fecha futura ya programada", () => {
    const fields = contactFields({ stage: "interesado", next_followup_at: addDaysISO(5) }, undefined, now);
    expect(fields).toEqual({ last_contact_at: now.toISOString() });
  });

  it("sin elegir (undefined) limpia un seguimiento vencido o de hoy, porque ya se atendió", () => {
    expect(contactFields({ stage: "contactado", next_followup_at: addDaysISO(-1) }, undefined, now).next_followup_at).toBeNull();
    expect(contactFields({ stage: "contactado", next_followup_at: todayISO() }, undefined, now).next_followup_at).toBeNull();
  });

  it("un prospecto nuevo pasa a 'contactado'; los demás conservan su etapa", () => {
    expect(contactFields({ stage: "nuevo" }, tomorrow, now).stage).toBe("contactado");
    expect(contactFields({ stage: "negociacion" }, tomorrow, now)).not.toHaveProperty("stage");
  });
});
