import { describe, expect, it } from "vitest";
import { citaToIcs, mapsUrl } from "./calendarEvent";

const now = new Date("2026-10-22T12:00:00Z");
const cita = { id: "c1", titulo: "Visita, casa Lerdo", fecha: "2026-11-03", hora: "16:30:00", lugar: "Av. Hidalgo 123, Lerdo", actividades: "Llevar llaves\nSegunda línea" };

describe("mapsUrl", () => {
  it("arma la búsqueda de Google Maps con el lugar escrito", () => {
    expect(mapsUrl("Av. Hidalgo 123, Lerdo")).toBe("https://www.google.com/maps/search/?api=1&query=Av.%20Hidalgo%20123%2C%20Lerdo");
  });
  it("respeta un enlace ya pegado y devuelve null sin lugar", () => {
    expect(mapsUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(mapsUrl("  ")).toBeNull();
    expect(mapsUrl(undefined)).toBeNull();
  });
});

describe("citaToIcs", () => {
  const ics = citaToIcs(cita, { clientName: "Ana", clientPhone: "871 111 2222", advisorName: "Luis", now });

  it("es un calendario válido con CRLF y un solo evento", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("UID:c1@aclpropiedades");
    expect(ics).toContain("DTSTAMP:20261022T120000Z");
  });

  it("una cita con hora dura una hora y lleva dos alarmas", () => {
    expect(ics).toContain("DTSTART:20261103T223000Z");
    expect(ics).toContain("DTEND:20261103T233000Z");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("TRIGGER:-PT15M");
  });

  it("escapa comas y saltos de línea, y lleva el lugar", () => {
    expect(ics).toContain("SUMMARY:Visita\\, casa Lerdo");
    expect(ics).toContain("LOCATION:Av. Hidalgo 123\\, Lerdo");
    // Las líneas largas van partidas (CRLF + espacio): se juntan antes de buscar.
    expect(ics.replace(/\r\n /g, "")).toContain("Llevar llaves\\nSegunda línea");
  });

  it("escapa el punto y coma y la diagonal invertida", () => {
    const text = citaToIcs({ ...cita, titulo: "A;B\\C" }, { now });
    expect(text).toContain("SUMMARY:A\\;B\\\\C");
  });

  it("una cita sin hora es de todo el día y avisa a las 9:00", () => {
    const allDay = citaToIcs({ ...cita, hora: null, lugar: null }, { now });
    expect(allDay).toContain("DTSTART;VALUE=DATE:20261103");
    expect(allDay).toContain("DTEND;VALUE=DATE:20261104");
    expect(allDay).toContain("TRIGGER:PT9H");
    expect(allDay).not.toContain("LOCATION");
  });

  it("ninguna línea pasa de 75 caracteres", () => {
    const long = citaToIcs({ ...cita, actividades: "x".repeat(300) }, { now });
    for (const line of long.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});

describe("citasToIcsFeed", () => {
  const cita = (id, extra = {}) => ({ id, titulo: `Visita ${id}`, fecha: "2026-11-20", hora: "10:00:00", duracion_min: 45, lugar: "Av. Hidalgo 100", actividades: "Mostrar la casa", ...extra });

  it("junta todas las citas en un solo calendario con su nombre y actualización cada hora", async () => {
    const { citasToIcsFeed } = await import("./calendarEvent");
    const ics = citasToIcsFeed([cita("a"), cita("b", { hora: null })], { name: "Agenda de Ana", now: new Date("2026-11-17T12:00:00Z") });
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-WR-CALNAME:Agenda de Ana");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics).toContain("UID:a@aclpropiedades");
    expect(ics).toContain("DTSTART:20261120T160000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
  });

  it("no filtra datos de contacto del cliente al calendario de terceros", async () => {
    const { citasToIcsFeed } = await import("./calendarEvent");
    const ics = citasToIcsFeed([cita("a", { contact_phone: "8711234567", contact_name: "Cliente Secreto" })]);
    expect(ics).not.toContain("8711234567");
    expect(ics).not.toContain("Cliente Secreto");
  });

  it("un calendario sin citas sigue siendo válido", async () => {
    const { citasToIcsFeed } = await import("./calendarEvent");
    const ics = citasToIcsFeed([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("VEVENT");
  });
});
