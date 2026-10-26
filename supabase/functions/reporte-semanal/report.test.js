import { describe, expect, it } from "vitest";
import { addDays, buildWeeklyReport, formatRange, mxDate, percentChange, renderWeeklyEmail, resolveRecipients, weekWindows } from "./report";

// Lunes 26 de octubre de 2026: se reporta del lunes 19 al domingo 25.
const TODAY = "2026-10-26";

describe("mxDate", () => {
  it("pasa tal cual una fecha sin hora", () => {
    expect(mxDate("2026-10-25")).toBe("2026-10-25");
  });

  it("cuenta el día de México, no el de UTC", () => {
    // 21:30 del domingo 25 en México (UTC-6) ya es lunes 26 en UTC.
    expect(mxDate("2026-10-26T03:30:00Z")).toBe("2026-10-25");
  });

  it("devuelve null con valores vacíos o inválidos", () => {
    expect(mxDate(null)).toBeNull();
    expect(mxDate("no es fecha")).toBeNull();
  });
});

describe("weekWindows", () => {
  it("la semana reportada termina ayer y dura 7 días; la anterior son los 7 previos", () => {
    expect(weekWindows(TODAY)).toEqual({
      current: { start: "2026-10-19", end: "2026-10-25" },
      previous: { start: "2026-10-12", end: "2026-10-18" },
    });
  });

  it("cruza meses y años", () => {
    expect(weekWindows("2027-01-04").current).toEqual({ start: "2026-12-28", end: "2027-01-03" });
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("percentChange", () => {
  it("calcula el cambio y no inventa porcentajes desde cero", () => {
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(3, 0)).toBeNull();
  });
});

const properties = [
  { id: "p1", title: "Casa Senderos", code: "ACL-1", price: 2000000, status: "disponible", active: true, created_at: "2026-10-20T15:00:00Z" },
  { id: "p2", title: "Depto Centro", code: "ACL-2", price: 1000000, status: "vendida", active: true, created_at: "2026-08-01T15:00:00Z" },
  { id: "p3", title: "Nave Lerdo", code: null, price: 5000000, status: "apartada", active: true, created_at: "2026-09-01T15:00:00Z" },
];

const data = {
  properties,
  ventas: [
    { property_id: "p2", fecha_venta: "2026-10-22" },
    { property_id: "p1", fecha_venta: "2026-10-15" }, // semana anterior
    { property_id: "p3", fecha_venta: "2026-09-01" }, // fuera de las dos
  ],
  visits: [
    { visited_at: "2026-10-21T17:00:00Z", interest: "oferta_realizada" },
    { visited_at: "2026-10-22T17:00:00Z", interest: "interesado" },
    { visited_at: "2026-10-23T17:00:00Z", interest: "descartado" },
    { visited_at: "2026-10-14T17:00:00Z", interest: "interesado" },
  ],
  prospects: [
    { source: "chatbot", stage: "nuevo", last_contact_at: null, created_at: "2026-10-20T16:00:00Z", next_followup_at: null },
    { source: "chatbot", stage: "contactado", last_contact_at: "2026-10-21T16:00:00Z", created_at: "2026-10-21T16:00:00Z", next_followup_at: "2026-10-24" },
    { source: "manual", stage: "nuevo", last_contact_at: null, created_at: "2026-10-22T16:00:00Z", next_followup_at: null },
    { source: "sitio", stage: "cerrado", last_contact_at: "2026-09-01T16:00:00Z", created_at: "2026-09-01T16:00:00Z", next_followup_at: "2026-09-02" },
  ],
  messages: [{ created_at: "2026-10-24T16:00:00Z" }, { created_at: "2026-10-01T16:00:00Z" }],
  views: [
    { property_id: "p1", viewed_on: "2026-10-20" },
    { property_id: "p1", viewed_on: "2026-10-21" },
    { property_id: "p3", viewed_on: "2026-10-21" },
    { property_id: "p1", viewed_on: "2026-10-13" },
    { property_id: "gone", viewed_on: "2026-10-21" },
  ],
};

describe("buildWeeklyReport", () => {
  const report = buildWeeklyReport(data, TODAY);

  it("cuenta ventas y su valor solo de la semana", () => {
    expect(report.current.salesCount).toBe(1);
    expect(report.current.salesValue).toBe(1000000);
    expect(report.previous.salesCount).toBe(1);
    expect(report.changes.salesCount).toBe(0);
  });

  it("cuenta visitas, interés y ofertas", () => {
    expect(report.current).toMatchObject({ visits: 3, visitsInterested: 2, visitsOffers: 1, propertiesAdded: 1, messages: 1 });
    expect(report.previous.visits).toBe(1);
    expect(report.changes.visits).toBe(200);
  });

  it("agrupa prospectos nuevos por origen", () => {
    expect(report.current.prospectsNew).toBe(3);
    expect(report.prospectsBySource).toEqual([
      { source: "chatbot", total: 2 },
      { source: "manual", total: 1 },
    ]);
  });

  it("ordena las propiedades más vistas y omite las que ya no existen", () => {
    expect(report.current.views).toBe(4);
    expect(report.topViewed).toEqual([
      { id: "p1", views: 2, title: "Casa Senderos", code: "ACL-1" },
      { id: "p3", views: 1, title: "Nave Lerdo", code: null },
    ]);
  });

  it("resume inventario y pendientes (solo prospectos entrantes sin contactar; seguimientos de etapas abiertas)", () => {
    expect(report.inventory).toEqual({ available: 1, reserved: 1 });
    expect(report.attention).toEqual({ unattended: 1, overdueFollowUps: 1 });
  });

  it("tolera datos vacíos", () => {
    const empty = buildWeeklyReport({}, TODAY);
    expect(empty.current.salesCount).toBe(0);
    expect(empty.topViewed).toEqual([]);
    expect(empty.attention).toEqual({ unattended: 0, overdueFollowUps: 0 });
  });
});

describe("renderWeeklyEmail", () => {
  it("arma asunto, html y texto con el rango de fechas", () => {
    const { subject, html, text } = renderWeeklyEmail(buildWeeklyReport(data, TODAY));
    expect(subject).toBe("Resumen semanal de ACL Propiedades: 19 al 25 de octubre");
    expect(html).toContain("Casa Senderos");
    expect(html).toContain("Para atender");
    expect(text).toContain("Ventas cerradas: 1");
  });

  it("escapa el texto que viene de la base", () => {
    const evil = buildWeeklyReport({ ...data, properties: [{ ...properties[0], title: '<script>alert("x")</script>' }, ...properties.slice(1)] }, TODAY);
    const { html } = renderWeeklyEmail(evil);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("no incluye utilidades ni liquidaciones", () => {
    const { html } = renderWeeklyEmail(buildWeeklyReport(data, TODAY));
    expect(html.toLowerCase()).not.toContain("utilidad:");
  });
});

describe("formatRange", () => {
  it("indica ambos meses cuando la semana los cruza", () => {
    expect(formatRange({ start: "2026-09-28", end: "2026-10-04" })).toBe("28 de septiembre al 4 de octubre");
  });
});

describe("resolveRecipients", () => {
  const rows = [
    { email: "Socio@acl.com", admin_roles: { sections: ["reportes", "propiedades"] } },
    { email: "asesor@acl.com", admin_roles: { sections: ["propiedades"] } },
    { email: "socio@acl.com", admin_roles: [{ sections: ["reportes"] }] },
    { email: "sin-rol@acl.com", admin_roles: null },
  ];

  it("toma solo los correos con el apartado reportes, sin repetir", () => {
    expect(resolveRecipients(rows)).toEqual(["socio@acl.com"]);
  });

  it("la lista fija tiene prioridad y se limpia", () => {
    expect(resolveRecipients(rows, " A@x.com, b@x.com ,mal-correo, a@x.com ")).toEqual(["a@x.com", "b@x.com"]);
  });
});
