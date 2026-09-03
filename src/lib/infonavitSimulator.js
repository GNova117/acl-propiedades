// Simulador conceptual de crédito Infonavit (crédito tradicional).
//
// Infonavit no expone una API pública para consultar UMA/tasas en vivo, así
// que estos parámetros se investigaron por búsqueda web (2026-09) y quedan
// fijos aquí, con su fuente — hay que actualizarlos a mano cuando cambien
// (la UMA se revisa cada febrero; las tasas, cuando Infonavit las ajuste).
//
// ⚠️ LIMITACIÓN CONOCIDA: el PDF oficial con la tabla ESCALONADA completa de
// tasas por nivel salarial (portalmx.infonavit.org.mx) no pudo consultarse
// al construir esto — el portal fue inalcanzable (timeout) por varios
// métodos. Sí hay confirmación coincidente de varias fuentes secundarias
// para los dos extremos de la tabla (3.69% hasta 2.6 UMA, 10.45% desde 6.6
// UMA); los tramos intermedios de este módulo son una INTERPOLACIÓN LINEAL
// entre esos dos puntos, no la tabla oficial real (que es escalonada, no
// continua). Ver README.md para las fuentes y por qué se hizo así.

export const UMA_2026 = {
  diario: 117.31,
  mensual: 3566.22,
  anual: 42794.64,
  vigenciaDesde: "2026-02-01",
  fuente: "INEGI (comunicado 8 de enero de 2026)",
};

// Extremos confirmados de la tabla de tasas diferenciadas por salario en
// UMA; ver limitación arriba sobre los tramos intermedios.
const TASA_MIN = 3.69; // hasta 2.6 UMA
const TASA_MAX = 10.45; // desde 6.6 UMA
const UMA_TASA_MIN = 2.6;
const UMA_TASA_MAX = 6.6;

export function tasaInteresPorUma(salarioEnUma) {
  if (salarioEnUma <= UMA_TASA_MIN) return TASA_MIN;
  if (salarioEnUma >= UMA_TASA_MAX) return TASA_MAX;
  const progreso = (salarioEnUma - UMA_TASA_MIN) / (UMA_TASA_MAX - UMA_TASA_MIN);
  return TASA_MIN + progreso * (TASA_MAX - TASA_MIN);
}

// Infonavit permite elegir un factor de descuento sobre nómina al originar
// el crédito (tope legal: 30% del salario base de cotización). 20% es el
// valor de referencia más citado; el usuario real lo confirma al tramitar.
export const FACTOR_DESCUENTO_REFERENCIA = 0.2;

// Regla de edad + plazo confirmada: hombres ≤ 70, mujeres ≤ 75. Plazo
// máximo 30 años en cualquier caso.
const EDAD_LIMITE = { hombre: 70, mujer: 75 };
const PLAZO_MAXIMO_ANIOS = 30;

// Tope máximo absoluto reportado para crédito tradicional Infonavit en 2026.
export const CREDITO_MAXIMO_ABSOLUTO = 2935002.35;

// Salario mensual (en UMA) hasta el cual Infonavit exenta los gastos de
// titulación. Los gastos financieros y de operación (antes ~3%) se
// eliminaron para créditos originados desde mayo de 2024 y ya no aplican a
// nadie — por eso este módulo los reporta siempre en $0.
const UMA_EXENCION_TITULACION = 2.6;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Pura: mismos inputs siempre producen el mismo resultado, nada se guarda.
export function simularCreditoInfonavit({ edad, sexo, salarioMensual, ssv }) {
  const salario = num(salarioMensual);
  const edadNum = num(edad);
  const saldoSsv = num(ssv);

  const salarioEnUma = UMA_2026.mensual > 0 ? salario / UMA_2026.mensual : 0;
  const tasaAnual = tasaInteresPorUma(salarioEnUma);

  const edadLimite = EDAD_LIMITE[sexo] || EDAD_LIMITE.hombre;
  const plazoAnios = Math.max(0, Math.min(PLAZO_MAXIMO_ANIOS, edadLimite - edadNum));
  const plazoMeses = plazoAnios * 12;

  const pagoMensual = salario * FACTOR_DESCUENTO_REFERENCIA;

  const tasaMensual = tasaAnual / 100 / 12;
  let montoCredito = 0;
  if (plazoMeses > 0 && pagoMensual > 0) {
    montoCredito =
      tasaMensual > 0
        ? pagoMensual * ((1 - Math.pow(1 + tasaMensual, -plazoMeses)) / tasaMensual)
        : pagoMensual * plazoMeses;
  }
  montoCredito = Math.min(montoCredito, CREDITO_MAXIMO_ABSOLUTO);

  const capacidadTotal = montoCredito + saldoSsv;
  const exentoTitulacion = salarioEnUma <= UMA_EXENCION_TITULACION;

  return {
    salarioEnUma,
    tasaAnual,
    plazoAnios,
    plazoMeses,
    pagoMensual,
    montoCredito,
    saldoSsv,
    capacidadTotal,
    exentoTitulacion,
    gastosFinancierosOperacion: 0,
  };
}
