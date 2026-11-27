import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { filterZones } from "../lib/zoneSearch";
import "./ZoneCombobox.css";

// 322: selector de zona con búsqueda. Antes era un <input list="…"> con <datalist>: en iPhone las sugerencias salen como una
// tira sobre el teclado y casi nadie las descubre. Aquí la lista se ve debajo del campo (al enfocarlo y mientras se escribe),
// busca sin importar acentos y se maneja con teclado (↑ ↓ Enter Esc). El valor sigue siendo el texto del campo: se puede
// escribir una zona que no esté en la lista (los filtros la buscan como texto).
export default function ZoneCombobox({ id, name = "zone", value, onChange, zones, placeholder }) {
  const { t } = useTranslation();
  const listId = useId();
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = useMemo(() => filterZones(zones, value), [zones, value]);

  const emit = (next) => onChange({ target: { name, value: next } });
  const choose = (zone) => {
    emit(zone.name);
    setOpen(false);
    setActive(-1);
  };

  // Cierra al tocar fuera.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length === 0 ? -1 : (i + 1) % options.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length === 0 ? -1 : (i <= 0 ? options.length - 1 : i - 1)));
    } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
      e.preventDefault(); // elegir una zona no debe enviar el formulario
      choose(options[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const showList = open && options.length > 0;
  const optionId = (i) => `${listId}-opt-${i}`;

  return (
    <div className="zone-combobox" ref={boxRef}>
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="zone-combobox__list" id={listId} role="listbox" aria-label={t("zoneCombobox.list")}>
          {options.map((zone, i) => (
            <li
              key={zone.id ?? zone.name}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              // pointerdown (no click): el campo pierde el foco antes del clic y la lista se cerraría sin elegir
              onPointerDown={(e) => {
                e.preventDefault();
                choose(zone);
              }}
            >
              {zone.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
