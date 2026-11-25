// Tope «un envío por minuto» de los formularios públicos, guardado en este navegador. Cada formulario tiene SU llave: si dos
// compartían la suya, mandar uno bloqueaba al otro (Contacto y solicitud de visita). Con el almacenamiento bloqueado (Safari con
// cookies bloqueadas, modo privado) no se lanza nada: simplemente no hay tope en el navegador (el servidor tiene los suyos).
export function lastSubmitAt(key) {
  try {
    return Number(window.localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
}

export function markSubmitted(key) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
}
