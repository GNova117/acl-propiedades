import { describe, expect, it } from "vitest";
import { prospectToCitaPrefill } from "./prospectAgenda";

const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe("prospectToCitaPrefill", () => {
  const prospect = { id: "p1", name: " María López ", phone: "871 123 4567", email: "maria@correo.com", advisor_id: "advisor-1", property_id: "prop-3", looking_for: "Casa 3 recámaras" };

  it("con propiedad de interés: título de visita, propiedad, prospecto y datos de contacto en la cita", () => {
    expect(prospectToCitaPrefill(prospect, { propertyTitle: "Casa Campestre", t })).toEqual({
      advisor_id: "advisor-1",
      titulo: 'prospects.schedulePrefill.visit:{"property":"Casa Campestre"}',
      property_id: "prop-3",
      prospecto_id: "p1",
      contact_name: "María López",
      contact_phone: "871 123 4567",
      contact_email: "maria@correo.com",
      actividades: 'prospects.schedulePrefill.lookingFor:{"text":"Casa 3 recámaras"}',
    });
  });

  it("sin propiedad: título «Cita con …», sin propiedad ligada y sin actividades si no busca nada", () => {
    const prefill = prospectToCitaPrefill({ ...prospect, property_id: null, looking_for: "" }, { t });
    expect(prefill.titulo).toBe('prospects.schedulePrefill.meeting:{"name":"María López"}');
    expect(prefill.property_id).toBe("");
    expect(prefill.actividades).toBe("");
  });

  it("si el prospecto ya es cliente, liga al cliente y no copia sus datos de contacto", () => {
    const prefill = prospectToCitaPrefill({ ...prospect, client_id: "cli-1" }, { propertyTitle: "Casa", t });
    expect(prefill.client_id).toBe("cli-1");
    expect(prefill).not.toHaveProperty("contact_name");
    expect(prefill).not.toHaveProperty("contact_phone");
    expect(prefill).not.toHaveProperty("contact_email");
  });

  it("un prospecto sin asesor deja el asesor vacío para que lo elija la oficina", () => {
    expect(prospectToCitaPrefill({ ...prospect, advisor_id: null }, { t }).advisor_id).toBe("");
  });
});
