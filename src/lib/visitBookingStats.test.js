import { describe, expect, it } from "vitest";
import { computeVisitBookingStats } from "./visitBookingStats";

// Martes 3 de noviembre de 2026, 12:00 (hora local, construido con partes para no depender de la zona).
const NOW = new Date(2026, 10, 3, 12, 0, 0);
const createdAt = (daysAgo) => new Date(2026, 10, 3 - daysAgo, 9, 0, 0).toISOString();

let n = 0;
const cita = (over = {}) => ({
  id: `c${++n}`,
  source: "sitio",
  status: "confirmada",
  advisor_id: "a1",
  fecha: "2026-11-10",
  hora: "10:00",
  duracion_min: 60,
  created_at: createdAt(2),
  client_confirmed_at: null,
  reschedule_count: 0,
  cancelled_by: null,
  ...over,
});

describe("computeVisitBookingStats", () => {
  it("sin reservas todo es cero o null (sin dividir entre cero)", () => {
    const s = computeVisitBookingStats([], { now: NOW });
    expect(s).toMatchObject({ booked: 0, upcoming: 0, toClose: 0, attended: 0, noShow: 0, cancelled: 0, closed: 0, attendanceRate: null, cancellationRate: null, avgLeadDays: null, byAdvisor: [] });
  });

  it("solo cuentan las reservas del sitio, no las citas que crea el equipo", () => {
    const s = computeVisitBookingStats([cita(), cita({ source: "admin" }), cita({ source: undefined })], { now: NOW });
    expect(s.booked).toBe(1);
  });

  it("reparte cada reserva en un solo estado: próxima, por cerrar, realizada, no asistió o cancelada", () => {
    const s = computeVisitBookingStats(
      [
        cita({ fecha: "2026-11-10" }), // próxima
        cita({ fecha: "2026-11-03", hora: "16:00" }), // hoy más tarde: próxima
        cita({ fecha: "2026-11-02" }), // ya pasó y nadie la cerró
        cita({ fecha: "2026-11-03", hora: "10:00" }), // hoy, ya terminó: por cerrar
        cita({ status: "realizada", fecha: "2026-11-01" }),
        cita({ status: "no_asistio", fecha: "2026-11-01" }),
        cita({ status: "cancelada", cancelled_by: "cliente" }),
        cita({ status: "cancelada", cancelled_by: "asesor" }),
      ],
      { now: NOW }
    );
    expect(s).toMatchObject({ booked: 8, upcoming: 2, toClose: 2, attended: 1, noShow: 1, cancelled: 2, cancelledByClient: 1, cancelledByAdvisor: 1, closed: 2 });
    expect(s.upcoming + s.toClose + s.attended + s.noShow + s.cancelled).toBe(s.booked);
  });

  it("la tasa de asistencia sale solo de las cerradas; la de cancelación, de todas las reservas", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => cita({ status: "realizada", fecha: "2026-10-30" })),
      cita({ status: "no_asistio", fecha: "2026-10-30" }),
      cita({ fecha: "2026-11-20" }), // próxima: no entra a la asistencia
      cita({ fecha: "2026-10-31" }), // por cerrar: tampoco
      cita({ status: "cancelada" }),
      cita({ status: "cancelada" }),
    ];
    const s = computeVisitBookingStats(rows, { now: NOW });
    expect(s.attendanceRate).toBe(75); // 3 de 4 cerradas
    expect(s.cancellationRate).toBe(25); // 2 de 8
  });

  it("compara la asistencia de quienes confirmaron con la de quienes no", () => {
    const confirmed = "2026-10-29T10:00:00Z";
    const rows = [
      cita({ status: "realizada", fecha: "2026-10-30", client_confirmed_at: confirmed }),
      cita({ status: "realizada", fecha: "2026-10-30", client_confirmed_at: confirmed }),
      cita({ status: "realizada", fecha: "2026-10-30" }),
      cita({ status: "no_asistio", fecha: "2026-10-30" }),
      cita({ status: "no_asistio", fecha: "2026-10-30" }),
    ];
    const s = computeVisitBookingStats(rows, { now: NOW });
    expect(s.attendanceConfirmed).toBe(100);
    expect(s.attendanceUnconfirmed).toBe(33.3);
  });

  it("con anticipación promedio, reprogramaciones y cuántas días antes se agenda", () => {
    const s = computeVisitBookingStats(
      [
        cita({ created_at: createdAt(0), fecha: "2026-11-05", reschedule_count: 1 }), // 2 días
        cita({ created_at: createdAt(1), fecha: "2026-11-06" }), // 4 días
        cita({ created_at: createdAt(2), fecha: "2026-11-03" }), // 2 días
        cita({ created_at: createdAt(0), fecha: "2026-11-03" }), // mismo día: 0
      ],
      { now: NOW }
    );
    expect(s.avgLeadDays).toBe(2);
    expect(s.rescheduled).toBe(1);
    expect(s.reschedulePct).toBe(25);
  });

  it("filtra por periodo (según cuándo se reservó) y por asesor", () => {
    const rows = [cita({ created_at: createdAt(5) }), cita({ created_at: createdAt(40) }), cita({ created_at: createdAt(2), advisor_id: "a2" })];
    expect(computeVisitBookingStats(rows, { now: NOW, periodDays: 30 }).booked).toBe(2);
    expect(computeVisitBookingStats(rows, { now: NOW }).booked).toBe(3);
    expect(computeVisitBookingStats(rows, { now: NOW, advisorId: "a2" }).booked).toBe(1);
  });

  it("desglosa por asesor, ordenado por reservas, con su propia asistencia", () => {
    const rows = [
      cita({ advisor_id: "a1", status: "realizada", fecha: "2026-10-30" }),
      cita({ advisor_id: "a1", status: "no_asistio", fecha: "2026-10-30" }),
      cita({ advisor_id: "a1", status: "cancelada" }),
      cita({ advisor_id: "a2", status: "realizada", fecha: "2026-10-30" }),
    ];
    const s = computeVisitBookingStats(rows, { now: NOW });
    expect(s.byAdvisor).toEqual([
      { advisorId: "a1", booked: 3, attended: 1, noShow: 1, cancelled: 1, attendanceRate: 50 },
      { advisorId: "a2", booked: 1, attended: 1, noShow: 0, cancelled: 0, attendanceRate: 100 },
    ]);
  });

  it("una cita vieja sin status cuenta como confirmada", () => {
    const old = cita({ status: undefined, fecha: "2026-10-01" });
    delete old.status;
    expect(computeVisitBookingStats([old], { now: NOW }).toClose).toBe(1);
  });
});
