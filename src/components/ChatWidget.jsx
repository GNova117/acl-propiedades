import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ChatIcon from "./icons/ChatIcon";
import { buildWhatsappHandoffMessage, whatsappHref } from "../lib/chatbot";
import "./ChatWidget.css";

const SESSION_KEY = "acl_chat_session_id";
const MESSAGES_KEY = "acl_chat_messages";

// Un id por pestaña/sesión del navegador (no identifica a la persona): lo
// usa el servidor para limitar mensajes por conversación — ver
// chat_rate_limits en supabase/schema.sql.
function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function loadSavedMessages() {
  try {
    const saved = sessionStorage.getItem(MESSAGES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Botón flotante que reemplazó al de WhatsApp directo: el chat es lo
// primero que ve quien visita el sitio, y WhatsApp queda siempre visible
// como plan B (encabezado del panel + aparece también si el chat falla).
export default function ChatWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadSavedMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const listRef = useRef(null);
  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) sessionIdRef.current = getSessionId();

  useEffect(() => {
    try {
      sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch {
      // Almacenamiento lleno/bloqueado: no es grave, solo se pierde el historial al recargar.
    }
  }, [messages]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, sending]);

  // Lo que ya se platicó va prellenado en el mensaje de WhatsApp (plan B):
  // el asesor no tiene que preguntar desde cero lo que el bot ya sabía.
  const handoffHref = useMemo(() => whatsappHref(buildWhatsappHandoffMessage(messages)), [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || notConfigured) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current, messages: next }),
      });
      const data = await res.json().catch(() => null);
      if (data?.configured === false) {
        setNotConfigured(true);
        setMessages((prev) => [...prev, { role: "assistant", content: t("chatWidget.unavailable"), fallback: true }]);
        return;
      }
      if (!res.ok || !data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: t("chatWidget.error"), fallback: true }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("chatWidget.error"), fallback: true }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="chat-widget__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("chatWidget.close") : t("chatWidget.open")}
        aria-expanded={open}
      >
        {open ? "×" : <ChatIcon size={26} />}
      </button>

      {open && (
        <div className="chat-widget__panel" role="dialog" aria-label={t("chatWidget.title")}>
          <div className="chat-widget__header">
            <span>{t("chatWidget.title")}</span>
            <a href={handoffHref} target="_blank" rel="noreferrer" className="chat-widget__whatsapp-link">
              {t("chatWidget.talkToAdvisor")}
            </a>
          </div>

          <div className="chat-widget__list" ref={listRef}>
            {messages.length === 0 && <div className="chat-widget__bubble chat-widget__bubble--assistant">{t("chatWidget.greeting")}</div>}
            {messages.map((m, i) => (
              <div key={i} className={`chat-widget__bubble chat-widget__bubble--${m.role}`}>
                <span>{m.content}</span>
                {m.fallback && (
                  <a href={handoffHref} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm chat-widget__fallback-btn">
                    {t("chatWidget.talkToAdvisor")}
                  </a>
                )}
              </div>
            ))}
            {sending && (
              <div className="chat-widget__bubble chat-widget__bubble--assistant chat-widget__typing" aria-label={t("chatWidget.typing")}>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form className="chat-widget__form" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chatWidget.placeholder")}
              disabled={sending || notConfigured}
              aria-label={t("chatWidget.placeholder")}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={sending || notConfigured || !input.trim()}>
              {t("chatWidget.send")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
