import { describe, expect, it } from "vitest";
import { activeCitas, canRegisterVisit, citaContact, citaDuration, citaStatus, citaToVisitPrefill, isCancelled, isOpenRequest, isPending, openRequests, statusActions, visitLink, visitLinkTextKey, visitsToClose, visitsToConfirm } from "./agendaCitas";

// Hoy a las 12:00 (hora local), construido con partes para no depender de la zona horaria.
const now = new Date();
now.setHours(12, 0, 0, 0);
const dayISO = (offset) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
};

const web = (id, fecha, hora, extra = {}) => ({ id, source: "sitio", status: "confirmada", fecha, hora, client_confirmed_at: null, ...extra });

describe("estatus", () => {
  it("una cita vieja sin status cuenta como confirmada y pendiente", () => {
    expect(citaStatus({})).toBe("confirmada");
    expect(isPending({})).toBe(true);
    expect(isCancelled({})).toBe(false);
  });

  it("activeCitas deja fuera solo las canceladas", () => {
    const citas = [{ id: "a" }, { id: "b", status: "cancelada" }, { id: "c", status: "realizada" }, { id: "d", status: "no_asistio" }];
    expect(activeCitas(citas).map((c) => c.id)).toEqual(["a", "c", "d"]);
  });

  it("una cita pendiente se puede cerrar o cancelar; una cerrada solo reactivar", () => {
    expect(statusActions({ status: "confirmada" })).toEqual(["realizada", "no_asistio", "cancelada"]);
    expect(statusActions({ status: "cancelada" })).toEqual(["confirmada"]);
    expect(statusActions({ status: "realizada" })).toEqual(["confirmada"]);
  });

  it("la duración sale de la cita y, sin dato, es de una hora", () => {
    expect(citaDuration({ duracion_min: 90 })).toBe(90);
    expect(citaDuration({})).toBe(60);
    expect(citaDuration({ duracion_min: 0 })).toBe(60);
  });
});

describe("citaContact", () => {
  it("usa al cliente ligado y, si no hay, los datos que dejó quien reservó", () => {
    const cita = { contact_name: "Ana", contact_phone: "871 1", contact_email: "a@c.co" };
    expect(citaContact(cita, { name: "Luis", phone: "871 2", email: "l@c.co" })).toEqual({ name: "Luis", phone: "871 2", email: "l@c.co" });
    expect(citaContact(cita)).toEqual({ name: "Ana", phone: "871 1", email: "a@c.co" });
    expect(citaContact({})).toEqual({ name: "", phone: "", email: "" });
  });
});

describe("visitsToConfirm", () => {
  it("trae las reservas del sitio sin confirmar de hoy a 2 días, ordenadas", () => {
    const list = visitsToConfirm(
      [
        web("pasado-manana", dayISO(2), "10:00"),
        web("hoy-tarde", dayISO(0), "16:00"),
        web("manana", dayISO(1), "09:00"),
        web("en-4-dias", dayISO(4), "10:00"),
      ],
      now
    );
    expect(list.map((c) => c.id)).toEqual(["hoy-tarde", "manana", "pasado-manana"]);
  });

  it("no cuenta las que ya empezaron, las confirmadas por el cliente, las canceladas ni las del equipo", () => {
    const list = visitsToConfirm(
      [
        web("ya-empezo", dayISO(0), "09:00"),
        web("confirmo", dayISO(1), "10:00", { client_confirmed_at: "2026-11-01T10:00:00Z" }),
        web("cancelada", dayISO(1), "11:00", { status: "cancelada" }),
        web("realizada", dayISO(0), "15:00", { status: "realizada" }),
        web("del-equipo", dayISO(1), "12:00", { source: "admin" }),
        web("sin-hora", dayISO(1), null),
        web("ayer", dayISO(-1), "10:00"),
      ],
      now
    );
    expect(list).toEqual([]);
  });
});

describe("cierre del ciclo", () => {
  const visita = { id: "c9", property_id: "p1", advisor_id: "a1", status: "confirmada", source: "sitio", fecha: dayISO(-2), hora: "16:00:00", contact_name: "Ana Pérez", contact_phone: "871 123 4567" };

  it("canRegisterVisit: solo una cita con propiedad y no cancelada", () => {
    expect(canRegisterVisit(visita)).toBe(true);
    expect(canRegisterVisit({ ...visita, status: "realizada" })).toBe(true);
    expect(canRegisterVisit({ ...visita, status: "cancelada" })).toBe(false);
    expect(canRegisterVisit({ ...visita, property_id: null })).toBe(false);
  });

  it("citaToVisitPrefill: propiedad, asesor, fecha y hora, nombre y teléfono, y la cita ligada", () => {
    expect(citaToVisitPrefill(visita, null, now)).toEqual({
      property_id: "p1",
      advisor_id: "a1",
      visited_at: `${dayISO(-2)}T16:00`,
      prospect_name: "Ana Pérez",
      prospect_phone: "871 123 4567",
      cita_id: "c9",
    });
  });

  it("si hay cliente ligado usa sus datos; una cita de más tarde se registra con la hora de ahora (no hay visitas futuras)", () => {
    const prefill = citaToVisitPrefill({ ...visita, fecha: dayISO(0), hora: "20:00" }, { name: "Luis Gómez", phone: "871 222 3333" }, now);
    expect(prefill).toMatchObject({ prospect_name: "Luis Gómez", prospect_phone: "871 222 3333", visited_at: `${dayISO(0)}T12:00` });
  });

  it("visitsToClose: visitas de los últimos 7 días, sin cerrar y sin contar hoy, las más viejas primero", () => {
    const rows = [
      { ...visita, id: "ayer", fecha: dayISO(-1) },
      { ...visita, id: "hace5", fecha: dayISO(-5) },
      { ...visita, id: "hoy", fecha: dayISO(0), hora: "09:00" },
      { ...visita, id: "hace9", fecha: dayISO(-9) },
      { ...visita, id: "cerrada", fecha: dayISO(-2), status: "realizada" },
      { ...visita, id: "cancelada", fecha: dayISO(-2), status: "cancelada" },
      { ...visita, id: "sin-propiedad", fecha: dayISO(-2), property_id: null },
      { ...visita, id: "futura", fecha: dayISO(3) },
    ];
    expect(visitsToClose(rows, now).map((c) => c.id)).toEqual(["hace5", "ayer"]);
  });
});

describe("visitLink", () => {
  const token = "0123456789abcdef0123456789abcdef";
  it("arma el enlace /visita/<token> de cualquier cita con token y hora (del sitio o capturada a mano)", () => {
    expect(visitLink({ source: "sitio", booking_token: token, hora: "10:00" }, "https://acl.mx")).toBe(`https://acl.mx/visita/${token}`);
    expect(visitLink({ source: "sitio", booking_token: token, hora: "10:00" }, "https://acl.mx/")).toBe(`https://acl.mx/visita/${token}`);
    expect(visitLink({ source: "admin", booking_token: token, hora: "16:30:00" }, "https://acl.mx")).toBe(`https://acl.mx/visita/${token}`);
  });
  it("sin hora (no hay nada que confirmar), con token inválido o ausente, no hay enlace", () => {
    expect(visitLink({ source: "admin", booking_token: token, hora: null }, "https://acl.mx")).toBe("");
    expect(visitLink({ source: "sitio", hora: "10:00" }, "https://acl.mx")).toBe("");
    expect(visitLink({ source: "sitio", booking_token: "abc", hora: "10:00" }, "https://acl.mx")).toBe("");
    expect(visitLink(null, "https://acl.mx")).toBe("");
  });
  it("el texto de WhatsApp: 'visita' si es de una propiedad, 'cita' si no", () => {
    expect(visitLinkTextKey({ property_id: "p1" })).toBe("visitLink.whatsappText");
    expect(visitLinkTextKey({ property_id: null })).toBe("visitLink.whatsappTextCita");
  });
});

describe("solicitudes de visita sin asesor", () => {
  const request = (over = {}) => ({ id: "r1", source: "sitio", status: "solicitada", advisor_id: null, fecha: dayISO(2), hora: "16:00", ...over });

  it("isOpenRequest: solicitada y sin asesor", () => {
    expect(isOpenRequest(request())).toBe(true);
    expect(isOpenRequest(request({ status: "confirmada", advisor_id: "a1" }))).toBe(false);
    expect(isOpenRequest(request({ status: "cancelada" }))).toBe(false);
    expect(isOpenRequest(request({ advisor_id: "a1" }))).toBe(false);
  });

  it("todavía no es de nadie: no cuenta como cita activa ni se puede cerrar o reactivar", () => {
    expect(activeCitas([request(), { id: "x", status: "confirmada", advisor_id: "a1" }]).map((c) => c.id)).toEqual(["x"]);
    expect(statusActions(request())).toEqual(["cancelada"]);
    expect(statusActions(request({ status: "cancelada" }))).toEqual([]); // cancelada sin asesor: no se reactiva
    expect(statusActions({ status: "cancelada", advisor_id: "a1" })).toEqual(["confirmada"]);
  });

  it("openRequests: las abiertas de hoy en adelante, las más próximas primero", () => {
    const list = [request({ id: "tarde", fecha: dayISO(3), hora: "10:00" }), request({ id: "ayer", fecha: dayISO(-1) }), request({ id: "pronto", fecha: dayISO(1), hora: "09:00" }), request({ id: "tomada", status: "confirmada", advisor_id: "a1" })];
    expect(openRequests(list, now).map((c) => c.id)).toEqual(["pronto", "tarde"]);
  });
});

describe("estatus heredado 'pendiente'", () => {
  it("una cita 'pendiente' (bases anteriores a este modelo) cuenta como confirmada y se puede atender", () => {
    expect(citaStatus({ status: "pendiente" })).toBe("confirmada");
    expect(isPending({ status: "pendiente" })).toBe(true);
    expect(statusActions({ status: "pendiente", advisor_id: "a1" })).toEqual(["realizada", "no_asistio", "cancelada"]);
    expect(activeCitas([{ status: "pendiente", advisor_id: "a1" }])).toHaveLength(1);
  });
});
