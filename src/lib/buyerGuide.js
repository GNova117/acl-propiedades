// Contenido de la "Guía del comprador" descargable (/guia-del-comprador). Es
// información general de referencia, sin cifras que caduquen (tasas, UMA,
// topes): lo que cambia seguido se remite al asesor. Los porcentajes que sí
// aparecen son los mismos valores de referencia del comparador de créditos
// (COMPARE_DEFAULTS / ratios de creditCompare.js), para que el sitio no diga
// una cosa en la guía y otra en la calculadora.
import { BANK_INCOME_RATIO, COMPARE_DEFAULTS, INFONAVIT_INCOME_RATIO } from "./creditCompare";

const pct = (ratio) => Math.round(ratio * 100);

export const BUYER_GUIDE = {
  title: "Guía del comprador",
  subtitle: "Cómo comprar tu casa, paso a paso",
  intro:
    "Comprar una propiedad es una de las decisiones más grandes de la vida. Esta guía resume, en lenguaje sencillo, lo que conviene saber y revisar antes de firmar. Es información general de referencia: cada caso es distinto y las condiciones de los créditos cambian con frecuencia, así que confirma todo con tu asesor.",
  sections: [
    {
      title: "1. Define tu presupuesto real",
      paragraphs: ["El precio de la propiedad no es lo único que vas a pagar. Antes de buscar, calcula tres números:"],
      bullets: [
        `La cuota mensual que puedes pagar sin apretarte. Como referencia, la cuota de un crédito bancario no debería pasar de cerca del ${pct(BANK_INCOME_RATIO)}% de tus ingresos mensuales; en Infonavit el descuento sobre el salario tiene un tope del ${pct(INFONAVIT_INCOME_RATIO)}%.`,
        `Tu enganche o ahorro inicial. Con crédito bancario suele pedirse un enganche; como referencia usamos ${COMPARE_DEFAULTS.bankDownPct}% del precio en el comparador de créditos del sitio.`,
        `Los gastos de escrituración e impuestos (notario, avalúo, registro, impuesto sobre adquisición). En el comparador usamos ${COMPARE_DEFAULTS.closingCostsPct}% del precio como referencia; el monto exacto te lo da el notario.`,
      ],
    },
    {
      title: "2. Elige cómo vas a pagar",
      paragraphs: ["Estas son las formas más comunes. Las condiciones (tasas, plazos, requisitos) cambian, por eso conviene comparar antes de decidir:"],
      bullets: [
        "Infonavit: para trabajadores con relación laboral. Se toma en cuenta tu salario, tu edad y el saldo de tu Subcuenta de Vivienda. Puedes consultar tu información en Mi Cuenta Infonavit.",
        "FOVISSSTE: para trabajadores del Estado, con reglas y líneas de crédito propias.",
        "Crédito bancario: cada banco ofrece tasa, enganche y plazo distintos; compara al menos dos o tres propuestas y revisa el costo total, no solo la mensualidad.",
        "Contado: sin crédito, pero cuida que te quede un respaldo para los gastos de escrituración y los imprevistos.",
      ],
      note: "En ACL Propiedades puedes comparar Infonavit, banco y contado para una propiedad concreta en la sección \"Comparar créditos\" del sitio.",
    },
    {
      title: "3. Reúne tus documentos desde el principio",
      paragraphs: ["Tener los papeles listos acelera el trámite. Normalmente se piden:"],
      bullets: [
        "Identificación oficial vigente (INE).",
        "CURP.",
        "Acta de nacimiento.",
        "Constancia de situación fiscal (RFC) del SAT.",
        "Comprobante de domicilio reciente.",
        "Comprobantes de ingresos y estados de cuenta, si vas a usar crédito bancario.",
        "Si usas Infonavit o FOVISSSTE: tu número de seguridad social y tu información de crédito.",
      ],
      note: "Tu asesor te dirá exactamente cuáles aplican a tu caso; algunos documentos pueden entregarse a distancia.",
    },
    {
      title: "4. Visita y revisa la propiedad",
      paragraphs: ["Visita varias antes de decidir y fíjate en lo que no se ve en las fotos:"],
      bullets: [
        "Estado legal: que las escrituras estén a nombre del vendedor, que esté libre de gravamen y que el predial y el agua estén al corriente.",
        "Condición física: humedades, grietas, instalaciones eléctricas, de agua y de gas, techos y acabados.",
        "Entorno: ruido, vialidades, escuelas, comercios, transporte y servicios de la zona a distintas horas del día.",
        "En terrenos y naves industriales: uso de suelo permitido, servicios disponibles y accesos.",
      ],
    },
    {
      title: "5. El proceso, paso a paso",
      numbered: [
        "Visita la propiedad y elige la que mejor te funciona.",
        "Haz tu oferta y, si te convence el trato, aparta la propiedad con un depósito (pide siempre recibo y que quede claro qué pasa con el depósito si algo no se concreta).",
        "Se realiza el avalúo, necesario cuando hay crédito.",
        "Tramita y autoriza tu crédito con la institución que elegiste.",
        "Firma de escrituras ante notario: se pagan los gastos de escrituración y se formaliza la compra.",
        "Entrega de la propiedad y de sus llaves, con los servicios al corriente.",
      ],
      note: "Los tiempos dependen del tipo de crédito y de la institución; con crédito el proceso suele tomar varias semanas.",
    },
    {
      title: "6. Errores comunes que conviene evitar",
      bullets: [
        "Comprar solo por la mensualidad, sin mirar el costo total del crédito.",
        "Dar dinero sin recibo o sin saber a quién se le entrega.",
        "No revisar el estado legal de la propiedad ni los adeudos.",
        "Ajustar el presupuesto al máximo y olvidar escrituración, mudanza y mantenimiento.",
        "Firmar algo que no entiendes: pide que te expliquen cada documento.",
      ],
    },
    {
      title: "Lista final antes de firmar",
      bullets: [
        "Presupuesto claro: mensualidad, enganche y gastos de escrituración.",
        "Crédito autorizado o pago de contado confirmado.",
        "Escrituras, predial y servicios revisados.",
        "Avalúo realizado.",
        "Fecha, notario y monto a pagar definidos por escrito.",
      ],
    },
  ],
  contactTitle: "¿Te acompañamos?",
  contact: [
    "ACL Propiedades",
    "Tel. y WhatsApp: 871 324 3271",
    "inmobiliaria@aclpropiedades.com",
  ],
  disclaimer:
    "Esta guía es información general y de referencia; no constituye asesoría legal, fiscal ni financiera, ni una oferta o aprobación de crédito. Las condiciones de los créditos y los costos cambian: confírmalos con tu asesor, la institución financiera y el notario.",
};
