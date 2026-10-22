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
    expect(ics).toContain("DTSTART:20261103T163000");
    expect(ics).toContain("DTEND:20261103T173000");
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
