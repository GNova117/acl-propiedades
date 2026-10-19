import { describe, expect, it } from "vitest";
import {
  INBOUND_SOURCES,
  daysSince,
  followUpState,
  messageToProspectFields,
  todayISO,
  toProspectFields,
  unattendedAge,
  unattendedState,
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

describe("unattendedState", () => {
  const now = new Date("2026-10-19T18:00:00Z");
  const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  const lead = (overrides = {}) => ({ stage: "nuevo", source: "chatbot", last_contact_at: null, created_at: hoursAgo(2), ...overrides });

  it("no avisa durante la primera hora", () => {
    expect(unattendedState(lead({ created_at: hoursAgo(0.5) }), now)).toBeNull();
  });

  it("avisa ('warn') desde la primera hora y marca 'late' desde las 4 h", () => {
    expect(unattendedState(lead({ created_at: hoursAgo(1) }), now)).toEqual({ hours: 1, level: "warn" });
    expect(unattendedState(lead({ created_at: hoursAgo(3.9) }), now)).toEqual({ hours: 3, level: "warn" });
    expect(unattendedState(lead({ created_at: hoursAgo(4) }), now)).toEqual({ hours: 4, level: "late" });
  });

  it("deja de aplicar en cuanto hay un contacto o la etapa cambia", () => {
    expect(unattendedState(lead({ last_contact_at: hoursAgo(1) }), now)).toBeNull();
    expect(unattendedState(lead({ stage: "contactado" }), now)).toBeNull();
  });

  it("solo cuenta prospectos entrantes, no los que captura el asesor", () => {
    for (const source of ["manual", "visita", "recomendacion", "redes", "otro"]) {
      expect(unattendedState(lead({ source }), now)).toBeNull();
    }
    for (const source of INBOUND_SOURCES) {
      expect(unattendedState(lead({ source }), now)).not.toBeNull();
    }
  });

  it("ignora una fecha de creación inválida", () => {
    expect(unattendedState(lead({ created_at: "no-es-fecha" }), now)).toBeNull();
  });
});

describe("unattendedAge", () => {
  it("usa horas hasta 47 y días después", () => {
    expect(unattendedAge(5)).toEqual({ unit: "hours", count: 5 });
    expect(unattendedAge(47)).toEqual({ unit: "hours", count: 47 });
    expect(unattendedAge(48)).toEqual({ unit: "days", count: 2 });
    expect(unattendedAge(75)).toEqual({ unit: "days", count: 3 });
  });
});
