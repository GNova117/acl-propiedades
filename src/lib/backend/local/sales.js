// Backend de modo demo (localStorage): métodos de «sales» (22). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { PROPERTIES, VENTAS_SEED, DEMO_ADMIN } from "../../seedData";
import { HOLD_STATUSES, OFFER_STATUSES, validateHold, validateOffer } from "../../offers";
import { validateContract } from "../../contracts";
import { COMMISSION_CONCEPTS, validatePayment } from "../../commissions";
import { KEYS, readStore, writeStore, uid } from "./shared.js";

export const salesMethods = {
  // En modo demo no hay restricción real de socios (ver AuthContext) — es
  // un sandbox local, no un límite de seguridad.
  async getLiquidacionByProperty(propertyId) {
    const items = readStore(KEYS.liquidaciones, []);
    return items.find((l) => l.property_id === propertyId) || null;
  },

  async addLiquidacion(propertyId, payload) {
    const items = readStore(KEYS.liquidaciones, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("liq"),
      property_id: propertyId,
      ...payload,
      usuario_actualizo: DEMO_ADMIN.email,
      created_at: now,
      updated_at: now,
    };
    items.push(record);
    writeStore(KEYS.liquidaciones, items);
    return record;
  },

  async updateLiquidacion(id, payload) {
    const items = readStore(KEYS.liquidaciones, []);
    const idx = items.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Liquidación no encontrada");
    const updated = { ...items[idx], ...payload, usuario_actualizo: DEMO_ADMIN.email, updated_at: new Date().toISOString() };
    items[idx] = updated;
    writeStore(KEYS.liquidaciones, items);
    return updated;
  },

  async getLiquidaciones() {
    return readStore(KEYS.liquidaciones, []);
  },

  // Cambia solo el estatus de una propiedad (sin pasar por el formulario
  // completo, que exige reenviar fotos, asesores, etc.). Replica a mano el
  // registro del Historial que en Supabase hace el trigger.
  async setPropertyStatus(id, status) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const idx = properties.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Propiedad no encontrada");
    if (properties[idx].status === status) return properties[idx];
    const changes = readStore(KEYS.propertyChanges, []);
    changes.push({
      id: uid("change"),
      property_id: id,
      changed_by: "Modo demo",
      field: "status",
      old_value: properties[idx].status,
      new_value: status,
      created_at: new Date().toISOString(),
    });
    writeStore(KEYS.propertyChanges, changes);
    properties[idx] = { ...properties[idx], status, updated_at: new Date().toISOString() };
    writeStore(KEYS.properties, properties);
    return properties[idx];
  },

  // Ofertas y apartados por propiedad (espejo de supabaseBackend, mismas validaciones y mismas claves de error).
  async getPropertyOffers(propertyId) {
    return readStore(KEYS.propertyOffers, [])
      .filter((o) => o.property_id === propertyId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async addPropertyOffer(propertyId, fields) {
    const checked = validateOffer(fields);
    if (checked.error) throw new Error(`offer:${checked.error}`);
    const offers = readStore(KEYS.propertyOffers, []);
    const record = { id: uid("offer"), property_id: propertyId, ...checked.value, status: "abierta", created_by: DEMO_ADMIN.email, created_at: new Date().toISOString() };
    offers.push(record);
    writeStore(KEYS.propertyOffers, offers);
    return record;
  },

  async setPropertyOfferStatus(id, status) {
    if (!OFFER_STATUSES.includes(status)) throw new Error("offer:status");
    const offers = readStore(KEYS.propertyOffers, []);
    const idx = offers.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error("Oferta no encontrada");
    offers[idx] = { ...offers[idx], status };
    writeStore(KEYS.propertyOffers, offers);
    return offers[idx];
  },

  async deletePropertyOffer(id) {
    writeStore(KEYS.propertyOffers, readStore(KEYS.propertyOffers, []).filter((o) => o.id !== id));
  },

  async getPropertyHolds(propertyId = null) {
    const holds = readStore(KEYS.propertyHolds, []);
    if (propertyId) return holds.filter((h) => h.property_id === propertyId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return holds.filter((h) => h.status === "vigente").sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  },

  async addPropertyHold(propertyId, fields) {
    const checked = validateHold(fields);
    if (checked.error) throw new Error(`hold:${checked.error}`);
    const holds = readStore(KEYS.propertyHolds, []);
    if (holds.some((h) => h.property_id === propertyId && h.status === "vigente")) throw new Error("hold:exists");
    const record = { id: uid("hold"), property_id: propertyId, advisor_id: null, ...checked.value, status: "vigente", created_by: DEMO_ADMIN.email, created_at: new Date().toISOString() };
    holds.push(record);
    writeStore(KEYS.propertyHolds, holds);
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === propertyId);
    if (property?.status === "disponible") await this.setPropertyStatus(propertyId, "apartada");
    return record;
  },

  async setPropertyHoldStatus(id, status) {
    if (!HOLD_STATUSES.includes(status) || status === "vigente") throw new Error("hold:status");
    const holds = readStore(KEYS.propertyHolds, []);
    const idx = holds.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error("Apartado no encontrado");
    holds[idx] = { ...holds[idx], status };
    writeStore(KEYS.propertyHolds, holds);
    if (status === "cancelado") {
      const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === holds[idx].property_id);
      if (property?.status === "apartada") await this.setPropertyStatus(property.id, "disponible");
    }
    return holds[idx];
  },

  // Contratos de intermediación y comisiones (espejo de supabaseBackend; en demo no hay RLS por socio).
  async getPropertyContracts() {
    return readStore(KEYS.propertyContracts, []).sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)));
  },

  async setPropertyContract(propertyId, fields) {
    const checked = validateContract(fields);
    if (checked.error) throw new Error(`contract:${checked.error}`);
    const contracts = readStore(KEYS.propertyContracts, []).filter((c) => c.property_id !== propertyId);
    const record = { property_id: propertyId, ...checked.value, updated_by: DEMO_ADMIN.email, updated_at: new Date().toISOString() };
    writeStore(KEYS.propertyContracts, [...contracts, record]);
    return record;
  },

  async deletePropertyContract(propertyId) {
    writeStore(KEYS.propertyContracts, readStore(KEYS.propertyContracts, []).filter((c) => c.property_id !== propertyId));
  },

  async getCommissions(propertyId = null) {
    return readStore(KEYS.commissions, [])
      .filter((c) => !propertyId || c.property_id === propertyId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async saveCommission(propertyId, { advisor_id, concept, amount }) {
    if (!COMMISSION_CONCEPTS.includes(concept) || !advisor_id || !(Number(amount) >= 0)) throw new Error("commission:invalid");
    const rows = readStore(KEYS.commissions, []);
    const idx = rows.findIndex((c) => c.property_id === propertyId && c.concept === concept);
    if (idx !== -1 && rows[idx].status === "pagada") throw new Error("commission:paid");
    const now = new Date().toISOString();
    if (idx === -1) {
      rows.push({ id: uid("comm"), property_id: propertyId, advisor_id, concept, amount: Math.round(Number(amount)), status: "pendiente", paid_on: null, created_at: now, updated_at: now });
    } else {
      rows[idx] = { ...rows[idx], advisor_id, amount: Math.round(Number(amount)), updated_at: now };
    }
    writeStore(KEYS.commissions, rows);
    return rows[idx === -1 ? rows.length - 1 : idx];
  },

  async setCommissionPaid(id, paidOn) {
    const rows = readStore(KEYS.commissions, []);
    const idx = rows.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Comisión no encontrada");
    let patch = { status: "pendiente", paid_on: null };
    if (paidOn) {
      const checked = validatePayment(paidOn);
      if (checked.error) throw new Error(`commission:${checked.error}`);
      patch = { status: "pagada", paid_on: checked.value };
    }
    rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
    writeStore(KEYS.commissions, rows);
    return rows[idx];
  },

  async deleteCommission(id) {
    writeStore(KEYS.commissions, readStore(KEYS.commissions, []).filter((c) => c.id !== id));
  },

  // Ventas registradas (quién vendió y cuándo). Una por propiedad. Registrar
  // una venta también deja la propiedad en "vendida"; deshacerla la regresa
  // a "disponible" — así el estatus público y el reporte no se contradicen.
  async getVentas() {
    return readStore(KEYS.ventas, VENTAS_SEED);
  },

  async saveVenta(propertyId, { advisor_id, fecha_venta }) {
    const items = readStore(KEYS.ventas, VENTAS_SEED);
    const idx = items.findIndex((v) => v.property_id === propertyId);
    const record = {
      id: idx === -1 ? uid("venta") : items[idx].id,
      property_id: propertyId,
      advisor_id: advisor_id || null,
      fecha_venta,
      usuario_registro: DEMO_ADMIN.email,
      created_at: idx === -1 ? new Date().toISOString() : items[idx].created_at,
    };
    if (idx === -1) items.push(record);
    else items[idx] = record;
    writeStore(KEYS.ventas, items);
    await this.setPropertyStatus(propertyId, "vendida");
    return record;
  },

  async deleteVenta(id, propertyId) {
    const items = readStore(KEYS.ventas, VENTAS_SEED);
    writeStore(KEYS.ventas, items.filter((v) => v.id !== id));
    await this.setPropertyStatus(propertyId, "disponible");
  },
};
