// Definición de campos del perfilamiento del comprador, tomada de la hoja
// de datos generales del comprador. Organizada en secciones, igual que la
// del vendedor — comparten el motor de perfilamientoShared.js.

import { ESTADOS_CIVILES } from "./perfilamientoShared";

export const COMPRADOR_SECTIONS = [
  {
    key: "comprador",
    title: "Datos generales del comprador",
    titleKey: "profiling.buyerSection",
    fields: [
      { key: "nombre", label: "Nombre completo del comprador", type: "text", required: true },
      { key: "nss", label: "NSS", type: "text", format: "nss" },
      { key: "telefono", label: "Teléfono", type: "tel", format: "telefono" },
      // Contraseña de portal de crédito (INFONAVIT/FOVISSSTE/banco), no del sistema.
      // Se guarda a petición explícita del negocio — ver README para el riesgo aceptado.
      { key: "contrasena_portal", label: "Contraseña (portal INFONAVIT/FOVISSSTE/banco)", type: "text", sensitive: true },
      { key: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date", required: true },
      { key: "estado_civil", label: "Estado civil", type: "select", options: ESTADOS_CIVILES },
      { key: "domicilio", label: "Domicilio", type: "textarea", required: true, full: true },
      { key: "correo", label: "Correo electrónico", type: "email", format: "email" },
      { key: "curp", label: "CURP", type: "text", format: "curp", uppercase: true },
      { key: "rfc", label: "RFC", type: "text", format: "rfc", uppercase: true },
      { key: "registro_patronal", label: "Registro patronal", type: "text" },
      { key: "tel_empresa", label: "Teléfono de la empresa", type: "tel" },
      { key: "razon_social", label: "Razón social", type: "text", full: true },
    ],
  },
  {
    key: "referencias",
    title: "Referencias personales",
    titleKey: "profiling.referencesSection",
    fields: [
      { key: "referencia1_nombre", label: "Referencia 1 — nombre completo", type: "text" },
      { key: "referencia1_telefono", label: "Referencia 1 — teléfono", type: "tel" },
      { key: "referencia2_nombre", label: "Referencia 2 — nombre completo", type: "text" },
      { key: "referencia2_telefono", label: "Referencia 2 — teléfono", type: "tel" },
    ],
  },
];

// Campos que la lista NO necesita: NSS, contraseña, CURP y RFC son datos
// sensibles y solo viajan cuando se abre un perfilamiento concreto.
export const PERFILAMIENTO_COMPRADOR_LIST_FIELDS = [
  "id",
  "cliente_id",
  "nombre",
  "telefono",
  "fecha_creacion",
  "fecha_modificacion",
];
