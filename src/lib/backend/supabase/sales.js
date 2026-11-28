// Backend con Supabase: métodos de «sales» (22). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { HOLD_STATUSES, OFFER_STATUSES, validateHold, validateOffer } from "../../offers";
import { validateContract } from "../../contracts";
import { validatePayment } from "../../commissions";
import { commissionFields, propertyStatusAfterHoldAdded, propertyStatusAfterHoldChange } from "../../backendRules";
import { isMissingTable } from "./shared.js";

export const salesMethods = {
  // Confidencial: restringida por RLS a los dos socios (ver schema.sql). Un
  // usuario autenticado que no sea socio simplemente recibe 0 filas / error
  // de política, no un error de "tabla no existe" — es la protección real.
  async getLiquidacionByProperty(propertyId) {
    const { data, error } = await supabase.from("liquidaciones").select("*").eq("property_id", propertyId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addLiquidacion(propertyId, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, property_id: propertyId, usuario_actualizo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("liquidaciones").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateLiquidacion(id, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      ...payload,
      usuario_actualizo: sessionData?.session?.user?.email || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("liquidaciones").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  // Todas las liquidaciones a la vez, para el reporte de ganancias. Mismo RLS
  // que getLiquidacionByProperty: quien no tenga el apartado 'liquidaciones'
  // recibe 0 filas, no un error.
  async getLiquidaciones() {
    const { data, error } = await supabase.from("liquidaciones").select("*");
    if (error) throw error;
    return data || [];
  },

  // Cambia solo el estatus (el trigger log_property_changes lo deja en el
  // Historial) sin reenviar el payload completo de updateProperty, que además
  // reescribe asesores y medios.
  async setPropertyStatus(id, status) {
    const { data, error } = await supabase
      .from("properties")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Ofertas y contraofertas de una propiedad (RLS: solo con el apartado Propiedades o Naves). Se validan aquí y
  // otra vez en la base (CHECKs); el error trae una clave `offer:<campo>` que la pantalla traduce.
  async getPropertyOffers(propertyId) {
    const { data, error } = await supabase.from("property_offers").select("*").eq("property_id", propertyId).order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return data || [];
  },

  async addPropertyOffer(propertyId, fields) {
    const checked = validateOffer(fields);
    if (checked.error) throw new Error(`offer:${checked.error}`);
    const { data, error } = await supabase.from("property_offers").insert({ property_id: propertyId, ...checked.value }).select().single();
    if (error) throw error;
    return data;
  },

  async setPropertyOfferStatus(id, status) {
    if (!OFFER_STATUSES.includes(status)) throw new Error("offer:status");
    const { data, error } = await supabase.from("property_offers").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePropertyOffer(id) {
    const { error } = await supabase.from("property_offers").delete().eq("id", id);
    if (error) throw error;
  },

  // Apartados: de una propiedad, o (sin `propertyId`) todos los vigentes, para el aviso de «por vencer» de Mi día.
  async getPropertyHolds(propertyId = null) {
    let query = supabase.from("property_holds").select("*");
    query = propertyId ? query.eq("property_id", propertyId).order("created_at", { ascending: false }) : query.eq("status", "vigente").order("due_date", { ascending: true });
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return data || [];
  },

  // Un apartado nuevo deja la propiedad en «apartada» (si estaba disponible). Solo hay uno vigente por propiedad.
  async addPropertyHold(propertyId, fields) {
    const checked = validateHold(fields);
    if (checked.error) throw new Error(`hold:${checked.error}`);
    const { data, error } = await supabase.from("property_holds").insert({ property_id: propertyId, ...checked.value }).select().single();
    if (error) {
      if (error.code === "23505") throw new Error("hold:exists");
      throw error;
    }
    const { data: property } = await supabase.from("properties").select("status").eq("id", propertyId).maybeSingle();
    const heldStatus = propertyStatusAfterHoldAdded(property?.status);
    if (heldStatus) await this.setPropertyStatus(propertyId, heldStatus);
    return data;
  },

  // «concretado» o «cancelado». Cancelar regresa la propiedad a «disponible» si seguía «apartada»; concretar
  // no toca el estatus (la venta se registra aparte, en Ventas).
  async setPropertyHoldStatus(id, status) {
    if (!HOLD_STATUSES.includes(status) || status === "vigente") throw new Error("hold:status");
    const { data, error } = await supabase.from("property_holds").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    if (status === "cancelado") {
      const { data: property } = await supabase.from("properties").select("status").eq("id", data.property_id).maybeSingle();
      const freed = propertyStatusAfterHoldChange(status, property?.status);
      if (freed) await this.setPropertyStatus(data.property_id, freed);
    }
    return data;
  },

  // Contrato de intermediación (exclusiva o abierta) con su vencimiento. Tabla aparte de properties (que se lee en
  // público). Sin el bloque SQL todavía, la lista llega vacía en vez de romper la pantalla.
  async getPropertyContracts() {
    const { data, error } = await supabase.from("property_contracts").select("*").order("expires_on", { ascending: true });
    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return data || [];
  },

  async setPropertyContract(propertyId, fields) {
    const checked = validateContract(fields);
    if (checked.error) throw new Error(`contract:${checked.error}`);
    const { data, error } = await supabase
      .from("property_contracts")
      .upsert({ property_id: propertyId, ...checked.value, updated_at: new Date().toISOString() }, { onConflict: "property_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePropertyContract(propertyId) {
    const { error } = await supabase.from("property_contracts").delete().eq("property_id", propertyId);
    if (error) throw error;
  },

  // Comisiones por asesor (RLS: los socios todas; cada asesor las suyas). Una por propiedad y concepto.
  async getCommissions(propertyId = null) {
    let query = supabase.from("commissions").select("*").order("created_at", { ascending: false });
    if (propertyId) query = query.eq("property_id", propertyId);
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return data || [];
  },

  // Registra (o actualiza el monto de) la comisión de ese concepto. Una ya pagada no se toca.
  async saveCommission(propertyId, { advisor_id, concept, amount }) {
    const fields = commissionFields({ advisor_id, concept, amount });
    const { data: existing, error: readError } = await supabase.from("commissions").select("id,status").eq("property_id", propertyId).eq("concept", concept).maybeSingle();
    if (readError) throw readError;
    if (existing?.status === "pagada") throw new Error("commission:paid");
    const row = { property_id: propertyId, ...fields, updated_at: new Date().toISOString() };
    const { data, error } = existing
      ? await supabase.from("commissions").update(row).eq("id", existing.id).select().single()
      : await supabase.from("commissions").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  // paidOn = fecha de pago → «pagada»; null → vuelve a «pendiente».
  async setCommissionPaid(id, paidOn) {
    let patch = { status: "pendiente", paid_on: null };
    if (paidOn) {
      const checked = validatePayment(paidOn);
      if (checked.error) throw new Error(`commission:${checked.error}`);
      patch = { status: "pagada", paid_on: checked.value };
    }
    const { data, error } = await supabase.from("commissions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCommission(id) {
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) throw error;
  },

  // Ventas registradas (quién vendió y cuándo), una por propiedad. RLS: solo
  // roles con el apartado 'reportes' (ver schema.sql). Registrar una venta
  // también deja la propiedad en "vendida"; deshacerla la regresa a
  // "disponible", para que el estatus público y el reporte no se contradigan.
  async getVentas() {
    const { data, error } = await supabase.from("ventas").select("*").order("fecha_venta", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async saveVenta(propertyId, { advisor_id, fecha_venta }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      property_id: propertyId,
      advisor_id: advisor_id || null,
      fecha_venta,
      usuario_registro: sessionData?.session?.user?.email || null,
    };
    const { data, error } = await supabase.from("ventas").upsert(row, { onConflict: "property_id" }).select().single();
    if (error) throw error;
    await this.setPropertyStatus(propertyId, "vendida");
    return data;
  },

  async deleteVenta(id, propertyId) {
    const { error } = await supabase.from("ventas").delete().eq("id", id);
    if (error) throw error;
    await this.setPropertyStatus(propertyId, "disponible");
  },
};
