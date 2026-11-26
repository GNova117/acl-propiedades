import i18n from "../i18n";
import { notify } from "./toast";

// Para las consultas del panel que no tenían `catch`: si fallaba la red la pantalla se quedaba en «Cargando…» para siempre y sin decir
// nada. Ahora se registra el error y se avisa con un aviso que se va solo.
export function notifyLoadError(err) {
  console.error("No se pudo cargar", err);
  notify(i18n.t("loadError.text"));
}
