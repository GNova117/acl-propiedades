// Último acceso conocido de la cuenta en ESTE dispositivo (correo, rol con sus apartados y asesor vinculado), para que el
// panel abra sin señal: sin red no se puede preguntar el rol ni renovar la sesión caducada, y sin esto la app se quedaba
// cargando o mandaba a un inicio de sesión que tampoco funciona sin red.
//
// No son datos de clientes ni credenciales, y no es una barrera de seguridad: solo decide qué pantallas se dibujan. Lo
// que se puede leer o cambiar lo siguen decidiendo las políticas del servidor, que vuelven a preguntarse al volver la
// señal (el panel renueva la sesión y el rol solo). Se borra al cerrar sesión.
const KEY = "acl_access_v1";

const normalize = (email) => String(email || "").trim().toLowerCase();

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return saved?.email && saved?.role && Array.isArray(saved.role.sections) ? saved : null;
  } catch {
    return null;
  }
}

export function forgetAccess() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: el panel funciona igual, solo no abre sin señal */
  }
}

// `access`: la fila de admin_access con su rol ({ role, advisor_id }). Sin acceso (o sin rol) no se recuerda nada.
export function rememberAccess(email, access) {
  const key = normalize(email);
  if (!key) return;
  const role = access?.role;
  if (!role || !Array.isArray(role.sections)) {
    forgetAccess();
    return;
  }
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ email: key, role: { id: role.id ?? null, slug: role.slug, name: role.name, sections: role.sections }, advisor_id: access.advisor_id ?? null })
    );
  } catch {
    /* lleno o bloqueado */
  }
}

// El acceso recordado de ese correo (no el de otra cuenta que haya entrado antes en este dispositivo).
export function recallAccess(email) {
  const saved = read();
  return saved && saved.email === normalize(email) ? { role: saved.role, advisor_id: saved.advisor_id } : null;
}

export const recallLastAccount = () => read();

// La «sesión» con la que se abre el panel cuando no hay red y la guardada ya caducó: solo trae el correo (lo que usan
// la cola de captura sin señal y el menú). Marcada con `offline` para distinguirla de una real.
export function offlineSessionFor(remembered) {
  return remembered?.email ? { user: { email: remembered.email }, offline: true } : null;
}
