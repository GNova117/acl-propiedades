// Cómo arranca la sesión del panel cuando puede que no haya señal (ver offlineAccess.js). Aparte del componente para poder
// probarlo con un `db` de mentira: es la parte de «Supabase sin red» que las pruebas e2e (modo demo) no alcanzan.
import { isOfflineError } from "./offlineQueue";
import { offlineSessionFor, recallAccess, recallLastAccount, rememberAccess } from "./offlineAccess";

// → { session, offline }. `offline`: la sesión es solo el correo recordado, porque la guardada caducó y sin red no se
// pudo renovar. Sin red y sin cuenta recordada (nunca entró aquí), o cualquier otro fallo: sin sesión.
export async function resolveSession(db) {
  try {
    return { session: await db.getCurrentSession(), offline: false };
  } catch (err) {
    if (!isOfflineError(err)) return { session: null, offline: false };
    const session = offlineSessionFor(recallLastAccount());
    return { session, offline: Boolean(session) };
  }
}

// → { role, advisorId, saved }. Pregunta el acceso (rol y asesor) de la cuenta y lo recuerda; sin red usa el recordado
// (`saved: true`). Un error que no es de red, o sin red y sin nada recordado, se lanza.
export async function resolveAccess(db, email) {
  try {
    const access = await db.getMyAccess(email);
    rememberAccess(email, access);
    return { role: access?.role || null, advisorId: access?.advisor_id || null, saved: false };
  } catch (err) {
    const saved = isOfflineError(err) ? recallAccess(email) : null;
    if (!saved) throw err;
    return { role: saved.role, advisorId: saved.advisor_id, saved: true };
  }
}
