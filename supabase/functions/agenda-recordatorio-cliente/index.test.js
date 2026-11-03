import { describe, expect, it } from "vitest";
import { buildPayload, buildReminders, formatWhen, normalizePhone, tomorrowInMexico } from "./index.ts";

describe("fechas y teléfonos", () => {
  it("tomorrowInMexico cuenta el día de México", () => {
    // 21:30 del lunes 2 en México ya es martes 3 en UTC: "mañana" es el martes 3.
    expect(tomorrowInMexico(new Date("2026-11-03T03:30:00Z"))).toBe("2026-11-03");
  });

  it("normalizePhone acepta 10 dígitos, con 52 y con 521", () => {
    expect(normalizePhone("871 123 4567")).toBe("528711234567");
    expect(normalizePhone("+52 871 123 4567")).toBe("528711234567");
    expect(normalizePhone("521 871 123 4567")).toBe("528711234567");
    expect(normalizePhone("123")).toBeNull();
  });

  it("formatWhen dice mañana, el día y la hora", () => {
    expect(formatWhen("2026-11-05", "16:00:00")).toContain("a las 16:00");
    expect(formatWhen("2026-11-05", null)).not.toContain("a las");
  });
});

describe("buildReminders", () => {
  const base = { id: "c1", titulo: "Visita: Casa", fecha: "2026-11-05", hora: "16:00:00", advisors: { name: "Carlos Delgado" } };

  it("una cita con cliente registrado usa su nombre y teléfono", () => {
    const { reminders } = buildReminders([{ ...base, clients: { name: "Luis Gómez", phone: "871 222 3333" } }]);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].to).toBe("528712223333");
    expect(reminders[0].params).toMatchObject({ nombre_cliente: "Luis", nombre_asesor: "Carlos Delgado", titulo_cita: "Visita: Casa" });
  });

  it("una visita reservada desde el sitio (sin cliente) usa el nombre y el teléfono que dejó", () => {
    const { reminders, skipped } = buildReminders([{ ...base, clients: null, contact_name: "Ana María Pérez", contact_phone: "871 123 4567" }]);
    expect(skipped).toEqual({});
    expect(reminders[0].to).toBe("528711234567");
    expect(reminders[0].params.nombre_cliente).toBe("Ana");
  });

  it("si hay cliente ligado, manda al cliente aunque la cita tenga datos de contacto", () => {
    const { reminders } = buildReminders([{ ...base, clients: { name: "Luis", phone: "871 222 3333" }, contact_name: "Otra", contact_phone: "871 000 0000" }]);
    expect(reminders[0].to).toBe("528712223333");
  });

  it("se omite sin cliente ni contacto, o con teléfono inválido, diciendo por qué", () => {
    const { reminders, skipped } = buildReminders([
      { ...base, id: "a", clients: null },
      { ...base, id: "b", clients: null, contact_name: "Ana", contact_phone: "123" },
      { ...base, id: "c", clients: { name: "Luis", phone: null } },
    ]);
    expect(reminders).toEqual([]);
    expect(skipped).toEqual({ a: "sin cliente asignado", b: "cliente sin teléfono válido", c: "cliente sin teléfono válido" });
  });

  it("la plantilla de WhatsApp lleva las 4 variables de siempre", () => {
    const { reminders } = buildReminders([{ ...base, clients: null, contact_name: "Ana", contact_phone: "871 123 4567" }]);
    const payload = buildPayload(reminders[0]);
    expect(payload.template.name).toBe("recordatorio_cita_cliente");
    expect(payload.template.components[0].parameters.map((p) => p.parameter_name)).toEqual(["nombre_cliente", "titulo_cita", "fecha_hora", "nombre_asesor"]);
  });
});
