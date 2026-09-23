// Etiquetas ya traducidas para el PDF del informe de visitas. Las arman por
// igual el panel del asesor y la página pública del vendedor (los dos ofrecen
// el botón "Descargar PDF"), así el PDF sale idéntico desde cualquiera de los
// dos y visitReportPdf.js no tiene que saber nada de i18n.
import { formatVisitDate, formatVisitDateTime, reasonLabel } from "./visitReport";

export function visitPdfLabels(t, language, payload, now = new Date()) {
  const property = payload?.property || {};
  const withOffer = (payload?.visits || []).filter((v) => v.interest === "oferta_realizada").length;
  return {
    title: t("visits.report.pdfTitle"),
    propertyLine: [property.code, property.title].filter(Boolean).join(" · "),
    zoneStatusLine: [
      property.zone && `${t("visits.report.zoneLabel")}: ${property.zone}`,
      property.status && `${t("visits.report.statusLabel")}: ${t(`propertyStatus.${property.status}`)}`,
    ]
      .filter(Boolean)
      .join("   ·   "),
    generatedLine: t("visits.report.generatedOn", { date: formatVisitDate(now.toISOString(), language) }),
    summary: t("visits.report.summary"),
    daysOnMarket: t("visits.report.daysOnMarket"),
    totalVisits: t("visits.report.totalVisits"),
    interested: t("visits.report.interested"),
    discarded: t("visits.report.discarded"),
    withOfferNote: withOffer > 0 ? t("visits.report.withOffer", { count: withOffer }) : null,
    untilSale: t("visits.report.untilSale"),
    reasonsTitle: t("visits.report.reasonsTitle"),
    reasonsNote: t("visits.report.reasonsNote"),
    reasonsEmpty: t("visits.report.reasonsEmpty"),
    reasonLabel: (key) => reasonLabel(t, key),
    reasonsPrefix: t("visits.report.reasonsPrefix"),
    logTitle: t("visits.report.logTitle"),
    logNote: t("visits.report.logNote"),
    logEmpty: t("visits.report.logEmpty"),
    interestLabel: (key) => t(`visits.interest.${key}`),
    formatDateTime: (iso) => formatVisitDateTime(iso, language),
  };
}
