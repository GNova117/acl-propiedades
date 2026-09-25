// Documentos que se llenan solos con los datos del cliente y de la propiedad:
// recibo de apartado, autorización de venta y carta oferta de compra.
// Son MODELOS GENÉRICOS: el texto de cada cláusula está aquí y conviene que lo
// revise un abogado antes de usarlos con clientes. Función pura (sin acceso a
// datos ni al navegador): recibe cliente, propiedad, asesor y los valores
// capturados, y devuelve el contenido que dibuja contractPdf.js.

export const CONTRACT_DOC_TYPES = ["recibo_apartado", "autorizacion_venta", "carta_oferta"];

export const PAYMENT_METHODS = ["efectivo", "transferencia", "cheque", "tarjeta"];
export const REFUND_OPTIONS = ["no_reembolsable", "reembolsable"];

const PLACE = "Torreón, Coahuila";

// Campos capturables por documento. `type`: number | date | select | text |
// checkbox | textarea. `required` obliga a llenarlo antes de generar el PDF.
export const CONTRACT_FIELDS = {
  recibo_apartado: [
    { key: "monto", type: "number", required: true },
    { key: "forma_pago", type: "select", options: PAYMENT_METHODS },
    { key: "fecha_limite", type: "date", required: true },
    { key: "reembolso", type: "select", options: REFUND_OPTIONS },
    { key: "notas", type: "textarea" },
  ],
  autorizacion_venta: [
    { key: "precio", type: "number", required: true },
    { key: "comision_pct", type: "number", required: true },
    { key: "vigencia_meses", type: "number", required: true },
    { key: "fecha_inicio", type: "date", required: true },
    { key: "exclusiva", type: "checkbox" },
    { key: "notas", type: "textarea" },
  ],
  carta_oferta: [
    { key: "monto", type: "number", required: true },
    { key: "forma_pago", type: "text", required: true },
    { key: "fecha_vigencia", type: "date", required: true },
    { key: "notas", type: "textarea" },
  ],
};

export const todayISO = () => new Date().toLocaleDateString("en-CA");
const addDaysISO = (days) => new Date(Date.now() + days * 86400000).toLocaleDateString("en-CA");

// Valores iniciales al elegir documento y propiedad.
export function defaultContractValues(type, property) {
  switch (type) {
    case "recibo_apartado":
      return { monto: "", forma_pago: "transferencia", fecha_limite: addDaysISO(15), reembolso: "no_reembolsable", notas: "" };
    case "autorizacion_venta":
      return { precio: property?.price ? String(property.price) : "", comision_pct: "5", vigencia_meses: "6", fecha_inicio: todayISO(), exclusiva: true, notas: "" };
    case "carta_oferta":
      return { monto: "", forma_pago: "Contado", fecha_vigencia: addDaysISO(7), notas: "" };
    default:
      return {};
  }
}

// Devuelve { campo: true } por cada campo obligatorio vacío o inválido.
export function validateContractValues(type, values) {
  const errors = {};
  for (const field of CONTRACT_FIELDS[type] || []) {
    if (!field.required) continue;
    const v = values[field.key];
    if (field.type === "number") {
      if (!(Number(v) > 0)) errors[field.key] = true;
    } else if (!String(v ?? "").trim()) {
      errors[field.key] = true;
    }
  }
  if (type === "autorizacion_venta" && Number(values.comision_pct) > 100) errors.comision_pct = true;
  return errors;
}

// ── Formato ──
const mxn = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(v) || 0);
const longDate = (iso) => {
  const d = iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`) : new Date();
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
};

// ── Número a letra (pesos mexicanos) ──
const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece",
  "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós",
  "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const TENS = { 30: "treinta", 40: "cuarenta", 50: "cincuenta", 60: "sesenta", 70: "setenta", 80: "ochenta", 90: "noventa" };
const HUNDREDS = { 200: "doscientos", 300: "trescientos", 400: "cuatrocientos", 500: "quinientos", 600: "seiscientos", 700: "setecientos", 800: "ochocientos", 900: "novecientos" };

function below1000(n) {
  if (n < 30) return UNITS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const unit = n % 10;
    return unit ? `${TENS[tens]} y ${UNITS[unit]}` : TENS[tens];
  }
  if (n === 100) return "cien";
  const hundreds = Math.floor(n / 100) * 100;
  const rest = n % 100;
  const head = hundreds === 100 ? "ciento" : HUNDREDS[hundreds];
  return rest ? `${head} ${below1000(rest)}` : head;
}

// "uno" → "un" y "veintiuno" → "veintiún" cuando va antes de "mil"/"millones".
const apocope = (words) => words.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

export function numberToWords(n) {
  const value = Math.floor(Math.abs(Number(n) || 0));
  if (value === 0) return "cero";
  const millions = Math.floor(value / 1e6);
  const thousands = Math.floor((value % 1e6) / 1000);
  const rest = value % 1000;
  const parts = [];
  if (millions) parts.push(millions === 1 ? "un millón" : `${apocope(numberToWords(millions))} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocope(below1000(thousands))} mil`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

// 1250000.5 → "UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS 50/100 M.N."
export function amountInWords(amount) {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  const pesos = Math.floor(n);
  const cents = String(Math.round((n - pesos) * 100)).padStart(2, "0");
  // Antes de "pesos" también se apocopa: "treinta y un pesos", "mil un pesos".
  const words = apocope(numberToWords(pesos)).toUpperCase();
  if (pesos === 1) return `UN PESO ${cents}/100 M.N.`;
  const de = pesos > 0 && pesos % 1e6 === 0 ? " DE" : "";
  return `${words}${de} PESOS ${cents}/100 M.N.`;
}

const propertyLabel = (p) => [p.title, p.code ? `(${p.code})` : ""].filter(Boolean).join(" ");
const propertyPlace = (p) => [p.address, p.zone].filter(Boolean).join(", ");

// Contenido del documento:
// { title, placeDate, paragraphs[], data: [[etiqueta, valor]], clauses[], signatures: [{ label, name }], fileName }
export function buildContractContent(type, { client, property, advisor, values }) {
  const advisorName = advisor?.name || "";
  const signOffice = { label: "ACL Propiedades", name: advisorName ? `Asesor: ${advisorName}` : "" };
  const notes = String(values.notas || "").trim();
  const noteRow = notes ? [["Observaciones", notes]] : [];
  const base = { placeDate: `${PLACE}, a ${longDate()}.`, fileName: `${type}_${client.name}` };

  if (type === "recibo_apartado") {
    const monto = Number(values.monto);
    const price = Number(property.price) || 0;
    const refundable = values.reembolso === "reembolsable";
    return {
      ...base,
      title: "RECIBO DE APARTADO",
      paragraphs: [
        `Recibí de ${client.name} (en adelante, "el Cliente") la cantidad de ${mxn(monto)} (${amountInWords(monto)}), mediante ${String(values.forma_pago || "").toLowerCase()}, por concepto de APARTADO del inmueble que se describe a continuación.`,
      ],
      data: [
        ["Inmueble", propertyLabel(property)],
        ["Ubicación", propertyPlace(property)],
        ["Precio de venta", mxn(price)],
        ["Monto del apartado", mxn(monto)],
        ...(price > monto ? [["Saldo por cubrir", mxn(price - monto)]] : []),
        ["Fecha límite para formalizar", longDate(values.fecha_limite)],
        ...noteRow,
      ],
      clauses: [
        `El apartado reserva el inmueble a favor del Cliente hasta el ${longDate(values.fecha_limite)}; durante ese periodo ACL Propiedades se abstiene de ofrecerlo a otras personas. No constituye contrato de compraventa ni transmite derecho de propiedad.`,
        "Si el Cliente formaliza la operación dentro del plazo, el monto del apartado se aplicará a cuenta del precio de venta.",
        refundable
          ? "Si la operación no se formaliza dentro del plazo, el monto del apartado será devuelto íntegramente al Cliente."
          : "Si la operación no se formaliza dentro del plazo por causas atribuibles al Cliente, el apartado no será reembolsable y el inmueble podrá ofrecerse nuevamente.",
        "Si la operación no se concreta por causas atribuibles al propietario o por falta de documentación del inmueble, el monto del apartado será devuelto íntegramente al Cliente.",
        "El Cliente manifiesta haber visitado el inmueble y conocer sus condiciones.",
      ],
      signatures: [{ ...signOffice, label: "Recibió: ACL Propiedades" }, { label: "Conforme: el Cliente", name: client.name }],
    };
  }

  if (type === "autorizacion_venta") {
    const exclusive = Boolean(values.exclusiva);
    return {
      ...base,
      title: "AUTORIZACIÓN PARA PROMOCIÓN Y VENTA DE INMUEBLE",
      paragraphs: [
        `${client.name} (en adelante, "el Propietario") autoriza a ACL Propiedades (en adelante, "la Inmobiliaria") a promover y comercializar el inmueble que se describe a continuación, bajo los siguientes términos.`,
      ],
      data: [
        ["Inmueble", propertyLabel(property)],
        ["Ubicación", propertyPlace(property)],
        ["Precio de lista", `${mxn(values.precio)} (${amountInWords(values.precio)})`],
        ["Comisión", `${Number(values.comision_pct)} % más IVA sobre el precio final de venta`],
        ["Vigencia", `${Number(values.vigencia_meses)} meses a partir del ${longDate(values.fecha_inicio)}`],
        ["Modalidad", exclusive ? "Con exclusiva" : "Sin exclusiva"],
        ...noteRow,
      ],
      clauses: [
        "La Inmobiliaria promoverá el inmueble en sus medios y portales, atenderá a los interesados, coordinará las visitas y dará seguimiento a las ofertas, informando al Propietario de cada avance.",
        exclusive
          ? "Durante la vigencia, el Propietario se obliga a no autorizar a otra persona o inmobiliaria para promover o vender el inmueble, y a canalizar a la Inmobiliaria a cualquier interesado que lo contacte directamente."
          : "Durante la vigencia, el Propietario podrá autorizar a otras personas o inmobiliarias para promover el inmueble.",
        "El Propietario pagará a la Inmobiliaria la comisión pactada cuando se concrete la venta, durante la vigencia, con un comprador presentado por la Inmobiliaria.",
        "El Propietario declara ser titular del inmueble o contar con facultades para venderlo, y que este se encuentra libre de gravámenes y adeudos, salvo los que manifieste por escrito a la Inmobiliaria. Se obliga a proporcionar la documentación necesaria para la operación.",
        "El precio de lista podrá modificarse únicamente por acuerdo escrito entre las partes.",
      ],
      signatures: [{ label: "El Propietario", name: client.name }, signOffice],
    };
  }

  // carta_oferta
  const monto = Number(values.monto);
  return {
    ...base,
    title: "CARTA OFERTA DE COMPRA",
    paragraphs: [
      `${client.name} (en adelante, "el Oferente") presenta formalmente a ACL Propiedades, para su consideración por el propietario, la siguiente oferta de compra.`,
    ],
    data: [
      ["Inmueble", propertyLabel(property)],
      ["Ubicación", propertyPlace(property)],
      ["Precio de lista", mxn(property.price)],
      ["Monto ofertado", `${mxn(monto)} (${amountInWords(monto)})`],
      ["Forma de pago", String(values.forma_pago || "")],
      ["Vigencia de la oferta", `Hasta el ${longDate(values.fecha_vigencia)}`],
      ...noteRow,
    ],
    clauses: [
      "Esta oferta está sujeta a la aceptación por escrito del propietario, a la revisión satisfactoria de la documentación del inmueble y a la firma del contrato correspondiente.",
      "La oferta no obliga a ninguna de las partes a celebrar la compraventa hasta que exista aceptación por escrito y contrato firmado.",
      `La oferta tendrá vigencia hasta el ${longDate(values.fecha_vigencia)}; después de esa fecha quedará sin efecto, salvo prórroga por escrito.`,
      "Los gastos de escrituración e impuestos se pagarán conforme a la ley y a lo que las partes convengan en el contrato.",
    ],
    signatures: [{ label: "El Oferente", name: client.name }, { ...signOffice, label: "Recibió: ACL Propiedades" }],
  };
}
