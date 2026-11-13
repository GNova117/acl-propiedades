import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "./dataStore";
import { revalidate, snapshot } from "./dataCache";
import { flushQueue, getQueue, isOnline, notifyQueueChanged, removeOp, retryOp, subscribeQueue } from "./offlineQueue";
import { queries } from "./queries";

const RETRY_MS = 60 * 1000; // reintento mientras haya algo pendiente y haya señal
const SENT_MESSAGE_MS = 6 * 1000; // cuánto se ve «Se enviaron N cambios»
const noop = () => {};

// La cola de captura sin señal de la cuenta (ver offlineQueue.js) y quien la envía: solo debe montarse UNA vez
// (en el aviso del panel). Envía al volver la señal, al volver a la app (de WhatsApp, de una llamada…), al
// aparecer algo pendiente teniendo señal y cada minuto mientras quede algo. Al terminar vuelve a pedir las listas
// que cambian (si ya estaban cargadas) para que se vea lo enviado.
//   online   — hay conexión (según el navegador)
//   ops      — todo lo que hay en la cola; pending — lo que espera envío; failed — lo que falló por algo que no es la red
//   flushing — se está enviando; sent — cuántos se acaban de enviar (se borra a los segundos)
//   flush()  — enviar ahora; discard(id) — descartar; retry(id) — volver a intentar uno que falló
export function useOfflineQueue() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const email = session?.user?.email || "";
  const ops = useSyncExternalStore(subscribeQueue, () => getQueue(email), () => getQueue(email));
  const [online, setOnline] = useState(isOnline);
  const [flushing, setFlushing] = useState(false);
  const [sent, setSent] = useState(0);
  const tRef = useRef(t);
  tRef.current = t;

  const pending = ops.filter((op) => !op.failed).length;
  const failed = ops.filter((op) => op.failed);

  const flush = useCallback(async () => {
    if (!email || !isOnline() || getQueue(email).every((op) => op.failed)) return;
    setFlushing(true);
    try {
      const result = await flushQueue({
        email,
        db,
        noteSuffix: (date) => tRef.current("offline.noteSuffix", { when: date.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) }),
      });
      if (result.sent > 0) {
        setSent(result.sent);
        for (const q of [queries.prospects, queries.stageHistory, queries.citas, queries.visits]) if (snapshot(q.key)) revalidate(q.key, q.fetch, { force: true }).catch(noop);
      }
    } catch {
      /* la cola conserva lo pendiente: se reintenta */
    } finally {
      setFlushing(false);
    }
  }, [email]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === "visible" && flush();
    // Un cambio hecho en otra pestaña (la cola es la misma).
    const onStorage = (e) => e.key?.startsWith("acl_offline_queue_v1:") && notifyQueueChanged();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush]);

  // Al abrir la app con algo pendiente, o cuando aparece algo teniendo señal (p. ej. una petición que no respondió).
  useEffect(() => {
    if (pending > 0 && online) flush();
  }, [pending, online, flush]);

  useEffect(() => {
    if (pending === 0 || !online) return undefined;
    const timer = setInterval(flush, RETRY_MS);
    return () => clearInterval(timer);
  }, [pending, online, flush]);

  useEffect(() => {
    if (!sent) return undefined;
    const timer = setTimeout(() => setSent(0), SENT_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [sent]);

  return {
    online,
    ops,
    pending,
    failed,
    flushing,
    sent,
    flush,
    discard: (id) => removeOp(email, id),
    retry: (id) => {
      retryOp(email, id);
      flush();
    },
  };
}
