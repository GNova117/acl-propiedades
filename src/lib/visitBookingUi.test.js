import { describe, expect, it } from "vitest";
import { bookingErrorField, bookingErrorKey, bookingToCalendarEvent, formatSlotDay, formatSlotTime, slotDayParts } from "./visitBookingUi";
import { citaToIcs } from "./calendarEvent";

describe("bookingErrorKey / bookingErrorField", () => {
  it("traduce los códigos de book_visit a su mensaje", () => {
    expect(bookingErrorKey("slot_unavailable")).toBe("slotTaken");
    expect(bookingErrorKey("invalid_slot")).toBe("slotTaken");
    expect(bookingErrorKey("rate_limited")).toBe("rateLimited");
    expect(bookingErrorKey("too_many_active")).toBe("tooManyActive");
    expect(bookingErrorKey("property_unavailable")).toBe("propertyUnavailable");
    expect(bookingErrorKey("algo_raro")).toBe("generic");
    expect(bookingErrorKey(undefined)).toBe("generic");
  });

  it("los errores de captura se asignan a su campo", () => {
    expect(bookingErrorField("invalid_name")).toBe("name");
    expect(bookingErrorField("invalid_email")).toBe("email");
    expect(bookingErrorField("invalid_phone")).toBe("phone");
    expect(bookingErrorField("invalid_note")).toBe("note");
    expect(bookingErrorField("slot_unavailable")).toBeNull();
  });
});

describe("formato de horarios", () => {
  it("la hora se muestra en 12 horas en español e inglés", () => {
    expect(formatSlotTime("16:00", "es-MX").replace(/\s/g, " ")).toMatch(/^4:00 p\.\s?m\.$/);
    expect(formatSlotTime("09:30:00", "en-US").replace(/\s/g, " ")).toBe("9:30 AM");
    expect(formatSlotTime("basura")).toBe("");
  });

  it("el día no depende de la zona horaria del navegador", () => {
    const parts = slotDayParts("2026-11-05", "es-MX");
    expect(parts.day).toBe("5");
    expect(parts.weekday.toLowerCase()).toContain("jue");
    expect(formatSlotDay("2026-11-05", "es-MX")).toBe("jueves, 5 de noviembre");
    expect(formatSlotDay("2026-12-31", "en-US")).toBe("Thursday, December 31");
  });
});

describe("bookingToCalendarEvent", () => {
  const result = { token: "a".repeat(32), fecha: "2026-11-05", hora: "16:00", duracion_min: 90, property: { title: " Casa Lerdo ", code: "ACL-12", address: "Av. Hidalgo 1, Lerdo" } };

  it("arma la cita con título, lugar y duración de la reserva", () => {
    expect(bookingToCalendarEvent(result, { note: " llevo a mi esposo " })).toEqual({
      id: "a".repeat(32),
      titulo: "Visita: Casa Lerdo (ACL-12)",
      fecha: "2026-11-05",
      hora: "16:00",
      duracion_min: 90,
      lugar: "Av. Hidalgo 1, Lerdo",
      actividades: "llevo a mi esposo",
    });
  });

  it("el archivo de calendario dura lo que dura la visita (90 min), no siempre una hora", () => {
    const ics = citaToIcs(bookingToCalendarEvent(result), { now: new Date("2026-11-03T12:00:00Z") });
    expect(ics).toContain("DTSTART:20261105T160000");
    expect(ics).toContain("DTEND:20261105T173000");
  });

  it("sin duración sigue durando una hora y sin código ni nota no inventa nada", () => {
    const event = bookingToCalendarEvent({ ...result, duracion_min: undefined, property: { title: "Casa", address: "" } });
    expect(event.titulo).toBe("Visita: Casa");
    expect(event.actividades).toBeNull();
    expect(citaToIcs(event, { now: new Date("2026-11-03T12:00:00Z") })).toContain("DTEND:20261105T170000");
  });
});
