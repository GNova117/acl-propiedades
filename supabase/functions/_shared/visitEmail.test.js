import { describe, expect, it } from "vitest";
import {
  REMINDER_2H,
  REMINDER_24H,
  addDays,
  buildVisitEmail,
  buildVisitIcs,
  esc,
  firstName,
  formatVisitDay,
  formatVisitTime,
  manageUrl,
  mapsUrl,
  mexicoNow,
  minutesUntilVisit,
  recentlyChanged,
  reminderKindFor,
  toBase64,
  visitLabel,
} from "./visitEmail";

const SITE = "https://sitio.test";
const TOKEN = "a".repeat(32);
const cita = {
  id: "c1",
  fecha: "2026-11-05",
  hora: "16:00:00",
  duracion_min: 90,
  booking_token: TOKEN,
  contact_name: "Ana María Pérez",
  contact_email: "ana@correo.com",
  reschedule_count: 0,
  cancelled_by: null,
  property: { id: "p1", title: "Casa en Lerdo", code: "ACL-12", address: "Av. Hidalgo 1, Lerdo" },
  advisor: { name: "Carlos Delgado" },
};
const NOW = new Date("2026-11-03T20:00:00Z"); // 14:00 en México (UTC-6)

describe("fechas de México", () => {
  it("mexicoNow usa la hora de México y no la de UTC", () => {
    expect(mexicoNow(new Date("2026-11-04T03:30:00Z"))).toEqual({ date: "2026-11-03", minutes: 21 * 60 + 30 });
  });

  it("addDays cruza fin de mes y de año sin depender de la zona", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("minutesUntilVisit cuenta desde la hora de México (y es negativo si ya empezó)", () => {
    expect(minutesUntilVisit("2026-11-03", "16:00", NOW)).toBe(120);
    expect(minutesUntilVisit("2026-11-04", "14:00:00", NOW)).toBe(1440);
    expect(minutesUntilVisit("2026-11-03", "13:00", NOW)).toBe(-60);
  });

  it("recentlyChanged: solo lo de las últimas 3 horas", () => {
    expect(recentlyChanged("2026-11-03T19:00:00Z", NOW)).toBe(true);
    expect(recentlyChanged("2026-11-03T16:59:00Z", NOW)).toBe(false);
    expect(recentlyChanged(null, NOW)).toBe(false);
  });
});

describe("reminderKindFor", () => {
  it("toca el de 24 h entre ~22.5 y 24 h antes y el de 2 h entre 1.5 y 2 h antes", () => {
    expect(reminderKindFor(1440)).toBe("recordatorio24h");
    expect(reminderKindFor(1351)).toBe("recordatorio24h");
    expect(reminderKindFor(1350)).toBeNull();
    expect(reminderKindFor(1441)).toBeNull();
    expect(reminderKindFor(120)).toBe("recordatorio2h");
    expect(reminderKindFor(91)).toBe("recordatorio2h");
    expect(reminderKindFor(90)).toBeNull();
    expect(reminderKindFor(-5)).toBeNull();
  });

  it("las ventanas miden más que los 15 min entre corridas de pg_cron (ninguna visita se escapa)", () => {
    expect(REMINDER_24H.max - REMINDER_24H.min).toBeGreaterThan(15);
    expect(REMINDER_2H.max - REMINDER_2H.min).toBeGreaterThan(15);
    // Recorre todos los minutos entre 2 h y 25 h antes: cada ventana, sin huecos de 15 min o más.
    let gap = 0;
    let maxGap = 0;
    for (let m = 1500; m >= 60; m--) {
      gap = reminderKindFor(m) ? 0 : gap + 1;
      if (m < 1440 && m > 100) maxGap = Math.max(maxGap, m > 120 && m <= 1350 ? 0 : gap);
    }
    expect(maxGap).toBeLessThan(15);
  });
});

describe("texto", () => {
  it("esc neutraliza HTML", () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe("&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
    expect(esc(null)).toBe("");
  });

  it("firstName, visitLabel y las URLs", () => {
    expect(firstName("  Ana María Pérez ")).toBe("Ana");
    expect(firstName("")).toBe("");
    expect(visitLabel(cita.property)).toBe("Casa en Lerdo (ACL-12)");
    expect(visitLabel({ title: " Casa " })).toBe("Casa");
    expect(manageUrl(SITE, TOKEN)).toBe(`${SITE}/visita/${TOKEN}`);
    expect(mapsUrl("Av. Hidalgo 1, Lerdo")).toBe("https://www.google.com/maps/search/?api=1&query=Av.%20Hidalgo%201%2C%20Lerdo");
    expect(mapsUrl("  ")).toBeNull();
  });

  it("formatea la fecha y la hora en español", () => {
    expect(formatVisitDay("2026-11-05")).toBe("jueves, 5 de noviembre de 2026");
    expect(formatVisitTime("16:00:00").replace(/\s/g, " ")).toMatch(/^4:00 p\.\s?m\.$/);
    expect(formatVisitTime("x")).toBe("");
  });
});

describe("buildVisitIcs", () => {
  const ics = buildVisitIcs(cita, { siteUrl: SITE, now: NOW });
  const flat = ics.replace(/\r\n /g, "");

  it("es un calendario con un evento, UID del token, duración real y alarmas", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(flat).toContain(`UID:${TOKEN}@aclpropiedades`);
    expect(flat).toContain("DTSTAMP:20261103T200000Z");
    expect(flat).toContain("DTSTART:20261105T160000");
    expect(flat).toContain("DTEND:20261105T173000"); // 90 min
    expect(flat).toContain("TRIGGER:-PT60M");
    expect(flat).toContain("TRIGGER:-PT15M");
    expect(flat).toContain("SEQUENCE:0");
  });

  it("escapa comas, punto y coma y saltos de línea, y lleva lugar y enlace para administrar", () => {
    const tricky = buildVisitIcs({ ...cita, property: { ...cita.property, title: "Casa; con, \"cosas\"", address: "Calle 1, Col. Centro; Lerdo" } }, { siteUrl: SITE, now: NOW }).replace(/\r\n /g, "");
    expect(tricky).toContain("SUMMARY:Visita: Casa\\; con\\, \"cosas\" (ACL-12)");
    expect(tricky).toContain("LOCATION:Calle 1\\, Col. Centro\\; Lerdo");
    expect(flat).toContain(`Ver\\, cambiar o cancelar tu visita: ${SITE}/visita/${TOKEN}`);
    expect(flat).toContain("Te atiende: Carlos Delgado\\n");
  });

  it("SEQUENCE sube con cada cambio de horario (el calendario actualiza el evento)", () => {
    expect(buildVisitIcs({ ...cita, reschedule_count: 2 }, { siteUrl: SITE, now: NOW })).toContain("SEQUENCE:2");
  });

  it("una visita sin duración dura una hora", () => {
    expect(buildVisitIcs({ ...cita, duracion_min: null }, { siteUrl: SITE, now: NOW })).toContain("DTEND:20261105T170000");
  });

  it("toBase64 respeta acentos (UTF-8)", () => {
    expect(toBase64("Visita: Pérez ✓")).toBe(Buffer.from("Visita: Pérez ✓", "utf8").toString("base64"));
  });
});

describe("buildVisitEmail", () => {
  const opts = { siteUrl: SITE, now: NOW };

  it("confirmación: asunto, fecha, propiedad, asesor, enlace para administrar y .ics adjunto", () => {
    const mail = buildVisitEmail("confirmacion", cita, opts);
    expect(mail.subject).toBe("Tu visita está agendada — Casa en Lerdo (ACL-12)");
    expect(mail.html).toContain("Hola, Ana.");
    expect(mail.html).toContain("Jueves, 5 de noviembre de 2026");
    expect(mail.html).toContain("Casa en Lerdo (ACL-12)");
    expect(mail.html).toContain("Carlos Delgado");
    expect(mail.html).toContain(`href="${SITE}/visita/${TOKEN}"`);
    expect(mail.html).toContain("google.com/maps/search");
    expect(mail.text).toContain(`Ver, cambiar o cancelar mi visita: ${SITE}/visita/${TOKEN}`);
    expect(mail.text).not.toMatch(/[<>]|&amp;/);
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].filename).toBe("visita.ics");
    expect(Buffer.from(mail.attachments[0].content, "base64").toString("utf8")).toContain("BEGIN:VEVENT");
  });

  it("solicitud sin asesor: dice que NO está confirmada, sin calendario ni asesor, con enlace para cancelar", () => {
    const email = buildVisitEmail("solicitud", { ...cita, advisor: null }, { siteUrl: SITE, now: NOW });
    expect(email.subject).toBe("Recibimos tu solicitud de visita — Casa en Lerdo (ACL-12)");
    expect(email.html).toContain("Todavía no está confirmada");
    expect(email.html).toContain("Horario que pediste");
    expect(email.html).not.toContain("Te atiende");
    expect(email.html).toContain(`${SITE}/visita/${TOKEN}`);
    expect(email.text).toContain("Ver o cancelar mi solicitud");
    expect(email.attachments).toEqual([]);
  });

  it("reprogramada: nuevo horario y .ics con SEQUENCE", () => {
    const mail = buildVisitEmail("reprogramada", { ...cita, fecha: "2026-11-07", hora: "10:00", reschedule_count: 1 }, opts);
    expect(mail.subject).toBe("Cambiamos tu visita — Casa en Lerdo (ACL-12)");
    expect(mail.html).toContain("Sábado, 7 de noviembre de 2026");
    expect(Buffer.from(mail.attachments[0].content, "base64").toString("utf8")).toContain("SEQUENCE:1");
  });

  it("cancelación por el cliente o por el asesor: sin .ics, con enlace para agendar otra y SIN el motivo", () => {
    const porCliente = buildVisitEmail("cancelacion", { ...cita, cancelled_by: "cliente", cancelled_reason: "nota interna" }, opts);
    const porAsesor = buildVisitEmail("cancelacion", { ...cita, cancelled_by: "asesor", cancelled_reason: "el cliente no contesta" }, opts);
    for (const mail of [porCliente, porAsesor]) {
      expect(mail.attachments).toEqual([]);
      expect(mail.html).toContain(`href="${SITE}/propiedades/p1"`);
      expect(mail.html).toContain("Era el");
      expect(mail.html + mail.text).not.toMatch(/nota interna|no contesta/);
    }
    expect(porCliente.html).toContain("Confirmamos la cancelación");
    expect(porAsesor.html).toContain("tuvimos que cancelar tu visita");
  });

  it("recordatorio de 24 h pide confirmar; el de 2 h pone primero el mapa", () => {
    const d24 = buildVisitEmail("recordatorio24h", cita, opts);
    expect(d24.subject).toBe("Recordatorio: tu visita es mañana — Casa en Lerdo (ACL-12)");
    expect(d24.html).toContain("Confirma que podrás asistir");
    expect(d24.html).toContain("Confirmar asistencia o cambiar");
    expect(d24.attachments).toEqual([]);

    const d2 = buildVisitEmail("recordatorio2h", cita, opts);
    expect(d2.subject).toBe("Tu visita es en 2 horas — Casa en Lerdo (ACL-12)");
    expect(d2.html.indexOf("Cómo llegar")).toBeLessThan(d2.html.indexOf("Ver, cambiar o cancelar mi visita"));
  });

  it("lo que escribió el visitante y los datos de la propiedad no inyectan HTML", () => {
    const evil = buildVisitEmail("confirmacion", { ...cita, contact_name: `<script>alert(1)</script> Eva`, property: { id: "p1", title: `Casa <b>x</b>`, code: null, address: `A & B "C"` } }, opts);
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).not.toContain("<b>x</b>");
    expect(evil.html).toContain("Casa &lt;b&gt;x&lt;/b&gt;");
    expect(evil.html).toContain("A &amp; B &quot;C&quot;");
  });

  it("sin nombre ni asesor ni dirección se arma igual, sin datos vacíos", () => {
    const mail = buildVisitEmail("confirmacion", { ...cita, contact_name: "", advisor: null, property: { id: "p1", title: "Casa", address: "" } }, opts);
    expect(mail.html).toContain("Hola.");
    expect(mail.html).not.toContain("Te atiende");
    expect(mail.html).not.toContain("Dónde");
    expect(mail.html).not.toContain("Cómo llegar");
  });

  it("un tipo desconocido lanza", () => {
    expect(() => buildVisitEmail("otra-cosa", cita, opts)).toThrow(/desconocido/);
  });
});
