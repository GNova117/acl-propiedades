import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PropertyCard from "./PropertyCard";
import { db } from "../lib/dataStore";
import "../pages/NotFound.css";

// «Mira estas propiedades»: unas cuantas disponibles (del tipo que se pida) para que una página sin salida (un enlace viejo, una
// ficha que ya no existe) lleve a algo. Solo pide 3 y no muestra nada si falla o no hay.
export default function SuggestedProperties({ type, count = 3 }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    db.getProperties({ activeOnly: true, statuses: ["disponible"], type: type || undefined, page: 0, pageSize: count })
      .then((result) => active && setItems(result.data || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [type, count]);

  if (items.length === 0) return null;
  return (
    <section className="not-found__featured" aria-labelledby="suggested-properties-title">
      <h2 id="suggested-properties-title">{t("notFound.featured")}</h2>
      <div className="not-found__grid">
        {items.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}
