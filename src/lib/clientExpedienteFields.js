// Datos del expediente que se capturan junto con el cliente: del comprador
// el NSS, la contraseña del portal de crédito, los datos de la empresa donde
// trabaja y 2 referencias personales; del vendedor el número de crédito.
//
// Estos mismos datos también se capturan en el perfilamiento (a petición
// explícita del negocio se piden en los dos lados, cada pantalla guarda su
// propia copia). Aquí viven pegados al cliente para que el expediente para
// avalúos los pueda imprimir sin depender de que exista un perfilamiento.
//
// Las etiquetas van en español directo, igual que perfilamientoComprador.js
// /perfilamientoVendedor.js: son definiciones que se usan tanto para pintar
// el formulario como para imprimir la hoja membretada.

export const CLIENT_BUYER_FIELDS = [
  { key: "nss", label: "Número de seguro social (NSS)", type: "text" },
  // Contraseña del portal de crédito (INFONAVIT/FOVISSSTE/banco), no del
  // sistema — mismo riesgo aceptado que en el perfilamiento, ver README.
  { key: "contrasena_portal", label: "Contraseña del portal (INFONAVIT/FOVISSSTE/banco)", type: "text", sensitive: true },
];

// Empresa donde trabaja el comprador: es lo que pide el trámite de crédito
// para comprobar la relación laboral. Mismas llaves que en el perfilamiento
// del comprador (`tel_empresa` es el número de la empresa).
export const CLIENT_COMPANY_FIELDS = [
  { key: "razon_social", label: "Razón social", type: "text", full: true },
  { key: "registro_patronal", label: "Registro patronal", type: "text" },
  { key: "tel_empresa", label: "Número de la empresa", type: "tel" },
];

export const CLIENT_SELLER_FIELDS = [{ key: "numero_credito", label: "Número de crédito", type: "text" }];

export const CLIENT_REFERENCE_FIELDS = [1, 2].flatMap((n) => [
  { key: `referencia${n}_nombre`, label: `Referencia ${n} — nombre completo`, type: "text" },
  { key: `referencia${n}_telefono`, label: `Referencia ${n} — número de teléfono`, type: "tel" },
  { key: `referencia${n}_correo`, label: `Referencia ${n} — correo`, type: "email" },
  { key: `referencia${n}_direccion`, label: `Referencia ${n} — dirección`, type: "text", full: true },
]);

export const CLIENT_EXPEDIENTE_KEYS = [
  ...CLIENT_BUYER_FIELDS,
  ...CLIENT_COMPANY_FIELDS,
  ...CLIENT_SELLER_FIELDS,
  ...CLIENT_REFERENCE_FIELDS,
].map((f) => f.key);

const COMPANY_TITLE = "Datos de la empresa";
const REFERENCES_TITLE = "Referencias personales";

// Qué se le pide a un cliente según su tipo: al comprador el crédito, la
// empresa y las referencias; al vendedor solo el número de crédito. Un
// cliente "ambos" ve las dos cosas. Se devuelve por bloques para que el
// formulario y la hoja membretada muestren los mismos encabezados.
export function clientExpedienteGroups(clientType) {
  const groups = [];
  if (clientType !== "vendedor") {
    groups.push({ key: "credito", title: "Datos del crédito", fields: CLIENT_BUYER_FIELDS });
    groups.push({ key: "empresa", title: COMPANY_TITLE, fields: CLIENT_COMPANY_FIELDS });
    groups.push({ key: "referencias", title: REFERENCES_TITLE, fields: CLIENT_REFERENCE_FIELDS });
  }
  if (clientType !== "comprador") {
    groups.push({ key: "venta", title: "Datos de la venta", fields: CLIENT_SELLER_FIELDS });
  }
  return groups;
}

const ROL_LABELS = { comprador: "Comprador", vendedor: "Vendedor", ambos: "Comprador y vendedor" };

// Secciones de la hoja de datos del cliente en el expediente — mismo formato
// que consumen buildPerfilamientoPdf/PerfilamientoManager (los campos vacíos
// no se imprimen y una sección `optional` sin nada se omite completa).
export function clientSheetSections(client) {
  const datos = {
    key: "cliente",
    title: "Datos del cliente",
    fields: [
      { key: "name", label: "Nombre completo", type: "text" },
      { key: "rol", label: "Rol en el expediente", type: "text" },
      { key: "phone", label: "Número de teléfono", type: "tel" },
      { key: "email", label: "Correo", type: "email" },
      ...(client.type !== "vendedor" ? CLIENT_BUYER_FIELDS : []),
      ...(client.type !== "comprador" ? CLIENT_SELLER_FIELDS : []),
      { key: "notes", label: "Notas", type: "textarea", full: true },
    ],
  };

  if (client.type === "vendedor") return [datos];
  return [
    datos,
    { key: "empresa", title: COMPANY_TITLE, optional: true, fields: CLIENT_COMPANY_FIELDS },
    { key: "referencias", title: REFERENCES_TITLE, optional: true, fields: CLIENT_REFERENCE_FIELDS },
  ];
}

// `rol` no es columna de la tabla: se deriva del tipo de cliente para que la
// hoja diga si es el comprador o el vendedor de la operación.
export function clientSheetData(client) {
  return { ...client, rol: ROL_LABELS[client.type] || client.type };
}
