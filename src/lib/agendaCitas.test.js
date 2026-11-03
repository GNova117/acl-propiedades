import { describe, expect, it } from "vitest";
import { activeCitas, citaContact, citaDuration, citaStatus, isCancelled, isPending, statusActions, visitsToConfirm } from "./agendaCitas";

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
