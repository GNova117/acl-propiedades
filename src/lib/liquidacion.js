// Cascada de cálculo de la liquidación financiera de una vivienda. Las tasas
// (captación/venta/gastos) son capturables por liquidación, no fijas en el
// código — el negocio pidió explícitamente poder ir ajustando el modelo.

export const DEFAULT_TASA_COMISION_CAPTACION = 40;
export const DEFAULT_TASA_COMISION_VENTA = 30;
export const DEFAULT_TASA_GASTOS_ADMIN = 10;
export const DEFAULT_TASA_PAGO_SERVICIOS = 10;

// costo_total vuelve a capturarse a mano (el precio de la propiedad ahora
// solo es una referencia informativa — ver "Precio de la propiedad" en
// AdminPropertyLiquidacion.jsx). inversion_remodelacion sigue sin vivir
// aquí: se calcula en vivo desde el proyecto de remodelación vinculado y se
// inyecta en el objeto que se le pasa a computeLiquidacion. El pago de
// servicios deja de capturarse como monto — ahora es un porcentaje
// (tasa_pago_servicios) sobre inversion_remodelacion, calculado dentro de
// computeLiquidacion.
export const EMPTY_LIQUIDACION = {
  costo_total: "",
  devolucion_vendedor: "",
  captador_id: "",
  vendedor_id: "",
  tasa_comision_captacion: DEFAULT_TASA_COMISION_CAPTACION,
  tasa_comision_venta: DEFAULT_TASA_COMISION_VENTA,
  tasa_gastos_admin: DEFAULT_TASA_GASTOS_ADMIN,
  tasa_pago_servicios: DEFAULT_TASA_PAGO_SERVICIOS,
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Pura: mismos datos de entrada siempre producen el mismo desglose. Se
// recalcula en cada render del formulario, no se guarda — así el modelo se
// puede seguir ajustando sin tener que migrar liquidaciones ya capturadas.
export function computeLiquidacion(form) {
  const costoTotal = num(form.costo_total);
  const devolucion = num(form.devolucion_vendedor);
  const remodelacion = num(form.inversion_remodelacion);
  const tasaServicios = num(form.tasa_pago_servicios);
  const servicios = remodelacion * (tasaServicios / 100);
  const tasaCaptacion = num(form.tasa_comision_captacion);
  const tasaVenta = num(form.tasa_comision_venta);
  const tasaGastos = num(form.tasa_gastos_admin);

  const inversion = remodelacion + servicios;
  const subtotal = costoTotal - devolucion - inversion;

  const comisionCaptacion = subtotal * (tasaCaptacion / 100);

  // Misma persona captó y vendió (o no se especificó vendedor distinto):
  // se queda con el 100% de la comisión de captación.
  const mismaPersona = !form.vendedor_id || form.vendedor_id === form.captador_id;
  const comisionVenta = mismaPersona ? 0 : comisionCaptacion * (tasaVenta / 100);
  const montoCaptador = comisionCaptacion - comisionVenta;

  const utilidadOficina = subtotal - comisionCaptacion;
  const gastosAdmin = utilidadOficina * (tasaGastos / 100);
  const utilidadNeta = utilidadOficina - gastosAdmin;

  return {
    servicios,
    inversion,
    subtotal,
    comisionCaptacion,
    mismaPersona,
    comisionVenta,
    montoCaptador,
    utilidadOficina,
    gastosAdmin,
    utilidadNeta,
  };
}

export function toLiquidacionPayload(form) {
  return {
    costo_total: num(form.costo_total),
    devolucion_vendedor: num(form.devolucion_vendedor),
    captador_id: form.captador_id || null,
    vendedor_id: form.vendedor_id || null,
    tasa_comision_captacion: num(form.tasa_comision_captacion),
    tasa_comision_venta: num(form.tasa_comision_venta),
    tasa_gastos_admin: num(form.tasa_gastos_admin),
    tasa_pago_servicios: num(form.tasa_pago_servicios),
  };
}

export function toLiquidacionFormValues(record) {
  if (!record) return { ...EMPTY_LIQUIDACION };
  const values = { ...EMPTY_LIQUIDACION };
  for (const key of Object.keys(EMPTY_LIQUIDACION)) {
    if (record[key] != null) values[key] = record[key];
  }
  return values;
}
