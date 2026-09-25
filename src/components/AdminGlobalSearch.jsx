import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import "./AdminGlobalSearch.css";

// Búsqueda global del panel: una caja en la barra superior que encuentra
// propiedades, clientes, prospectos, estimaciones, mensajes, visitas y
// registros de Secretaría, y lleva directo a la pantalla. Solo consulta los
// apartados que el rol tiene (y RLS recorta lo demás). Los datos se cargan la
// primera vez que se usa y se refrescan si pasó más de un minuto.
const CACHE_MS = 60_000;
const MAX_PER_GROUP = 5;

const normalize = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const digits = (s) => String(s ?? "").replace(/\D/g, "");

// Cada fuente sabe cargar sus filas y describirlas: { id, title, sub, text, phones, to }.
const SOURCES = [
  {
    key: "properties",
    section: "propiedades",
    load: () => db.getProperties({}),
    map: (p) => ({
      id: p.id,
      title: p.title,
      sub: [p.code, p.zone].filter(Boolean).join(" · "),
      text: [p.title, p.code, p.zone, p.address, p.colonia],
      to: `/admin/propiedades/${p.id}`,
    }),
  },
  {
    key: "clients",
    section: "clientes",
    load: () => db.getClients(),
    map: (c) => ({
      id: c.id,
      title: c.name,
      sub: [c.phone, c.email].filter(Boolean).join(" · "),
      text: [c.name, c.email],
      phones: [c.phone],
      to: `/admin/clientes/${c.id}`,
    }),
  },
  {
    key: "prospects",
    section: "prospectos",
    load: () => db.getProspects(),
    map: (p) => ({
      id: p.id,
      title: p.name,
      sub: [p.stage, p.phone].filter(Boolean).join(" · "),
      text: [p.name, p.email, p.looking_for],
      phones: [p.phone],
      to: `/admin/prospectos/${p.id}`,
    }),
  },
  {
    key: "valuations",
    section: "valuacion",
    load: () => db.getValuationEstimates(),
    map: (v) => ({
      id: v.id,
      title: v.reference || v.zone_name || "—",
      sub: [v.zone_name, new Date(v.created_at).toLocaleDateString("es-MX")].filter(Boolean).join(" · "),
      text: [v.reference, v.zone_name],
      to: "/admin/valuacion",
    }),
  },
  {
    key: "messages",
    section: "mensajes",
    load: () => db.getContactMessages(),
    map: (m) => ({
      id: m.id,
      title: m.name || m.email || "—",
      sub: String(m.message || "").slice(0, 60),
      text: [m.name, m.email, m.message],
      phones: [m.phone],
      to: "/admin/mensajes",
    }),
  },
  {
    key: "visits",
    section: "visitas",
    load: () => db.getVisits(),
    map: (v) => ({
      id: v.id,
      title: v.prospect_name || "—",
      sub: [v.looking_for, v.prospect_phone].filter(Boolean).join(" · "),
      text: [v.prospect_name, v.looking_for],
      phones: [v.prospect_phone],
      to: `/admin/visitas/${v.id}`,
    }),
  },
  {
    key: "keys",
    section: "secretaria",
    load: () => db.getSecretariaLog("keys"),
    map: (k) => ({
      id: k.id,
      title: `${k.key_label} · ${k.address}`,
      sub: k.receiver_name,
      text: [k.key_label, k.address, k.receiver_name],
      phones: [k.receiver_phone],
      to: "/admin/secretaria",
    }),
  },
  {
    key: "docs",
    section: "secretaria",
    load: () => db.getSecretariaLog("docs"),
    map: (d) => ({
      id: d.id,
      title: `${d.doc_type} · ${d.property_client}`,
      sub: d.person_name,
      text: [d.doc_type, d.property_client, d.person_name],
      to: "/admin/secretaria",
    }),
  },
];

export default function AdminGlobalSearch() {
  const { t } = useTranslation();
  const { hasSection } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const loadedAt = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState({}); // key -> items ya normalizados
  const [active, setActive] = useState(0);

  const ensureLoaded = useCallback(async () => {
    if (Date.now() - loadedAt.current < CACHE_MS) return;
    loadedAt.current = Date.now();
    setLoading(true);
    const usable = SOURCES.filter((s) => hasSection(s.section));
    const results = await Promise.allSettled(usable.map((s) => s.load()));
    const next = {};
    usable.forEach((source, i) => {
      const rows = results[i].status === "fulfilled" ? results[i].value : [];
      next[source.key] = (rows || []).map((row) => {
        const item = source.map(row);
        return { ...item, hay: normalize(item.text.filter(Boolean).join(" ")), phoneDigits: (item.phones || []).map(digits).filter(Boolean) };
      });
    });
    setIndex(next);
    setLoading(false);
  }, [hasSection]);

  // Atajos: "/" o Ctrl/Cmd+K enfocan la búsqueda desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    const qDigits = digits(query);
    if (q.length < 2) return [];
    return SOURCES.map((source) => {
      const matches = (index[source.key] || []).filter(
        (item) => item.hay.includes(q) || (qDigits.length >= 4 && item.phoneDigits.some((d) => d.includes(qDigits)))
      );
      return { key: source.key, items: matches.slice(0, MAX_PER_GROUP), total: matches.length };
    }).filter((g) => g.items.length > 0);
  }, [query, index]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (item) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    }
  };

  const showPanel = open && query.trim().length >= 2;
  let flatIndex = -1;

  return (
    <div className="admin-search" ref={boxRef}>
      <input
        ref={inputRef}
        type="search"
        className="admin-search__input"
        value={query}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        aria-expanded={showPanel}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          ensureLoaded();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          ensureLoaded();
        }}
        onKeyDown={onKeyDown}
      />
      {showPanel && (
        <div className="admin-search__panel" role="listbox">
          {loading && flat.length === 0 && <p className="admin-search__note">{t("search.loading")}</p>}
          {!loading && flat.length === 0 && <p className="admin-search__note">{t("search.noResults", { query: query.trim() })}</p>}
          {groups.map((group) => (
            <div key={group.key} className="admin-search__group">
              <div className="admin-search__group-title">
                {t(`search.groups.${group.key}`)}
                {group.total > group.items.length && <span> · {t("search.more", { count: group.total - group.items.length })}</span>}
              </div>
              {group.items.map((item) => {
                flatIndex += 1;
                const isActive = flatIndex === active;
                return (
                  <button
                    type="button"
                    key={`${group.key}-${item.id}`}
                    role="option"
                    aria-selected={isActive}
                    className={`admin-search__item${isActive ? " is-active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(item)}
                  >
                    <span className="admin-search__title">{item.title}</span>
                    {item.sub && <span className="admin-search__sub">{item.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
