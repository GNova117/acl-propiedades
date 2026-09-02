import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import PerfilamientoManager from "../../components/PerfilamientoManager";
import { VENDEDOR_SECTIONS, vendedorExtraRules } from "../../lib/perfilamientoVendedor";
import { COMPRADOR_SECTIONS } from "../../lib/perfilamientoComprador";
import "./AdminClientProfiling.css";
import "./admin.css";

export default function AdminClientProfiling() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tipo");
  const [tab, setTab] = useState(tabParam === "comprador" ? "comprador" : "vendedor");
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getClientById(id).then((data) => {
      setClient(data);
      setLoading(false);
    });
  }, [id]);

  const selectTab = (next) => {
    setTab(next);
    setSearchParams(next === "comprador" ? { tipo: "comprador" } : {}, { replace: true });
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("profiling.title")}</h1>
          <p className="form-hint">{client?.name}</p>
        </div>
        <Link to={`/admin/clientes/${id}`} className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>

      <div className="profiling-tabs">
        <button
          type="button"
          className={`profiling-tabs__tab${tab === "vendedor" ? " profiling-tabs__tab--active" : ""}`}
          onClick={() => selectTab("vendedor")}
        >
          {t("profiling.sellerTab")}
        </button>
        <button
          type="button"
          className={`profiling-tabs__tab${tab === "comprador" ? " profiling-tabs__tab--active" : ""}`}
          onClick={() => selectTab("comprador")}
        >
          {t("profiling.buyerTab")}
        </button>
      </div>

      {tab === "vendedor" ? (
        <PerfilamientoManager
          key="vendedor"
          clienteId={id}
          sections={VENDEDOR_SECTIONS}
          extraRules={vendedorExtraRules}
          nombreKey="nombre_completo"
          pdfTitle="PERFILAMIENTO"
          filePrefix="Perfilamiento_Vendedor"
          emptyMessageKey="profiling.noResultsSeller"
          newLabelKey="profiling.newSeller"
          listColumns={[
            { key: "nombre_completo", label: t("profiling.seller") },
            { key: "ubicacion", label: t("profiling.property") },
            { key: "fecha_creacion", label: t("profiling.createdAt"), format: "fecha" },
          ]}
          backend={{
            list: db.getPerfilamientosVendedor,
            getById: db.getPerfilamientoVendedorById,
            add: db.addPerfilamientoVendedor,
            update: db.updatePerfilamientoVendedor,
            remove: db.deletePerfilamientoVendedor,
          }}
        />
      ) : (
        <PerfilamientoManager
          key="comprador"
          clienteId={id}
          sections={COMPRADOR_SECTIONS}
          nombreKey="nombre"
          pdfTitle="PERFILAMIENTO DEL COMPRADOR"
          filePrefix="Perfilamiento_Comprador"
          emptyMessageKey="profiling.noResultsBuyer"
          newLabelKey="profiling.newBuyer"
          listColumns={[
            { key: "nombre", label: t("profiling.buyer") },
            { key: "telefono", label: t("clients.phone") },
            { key: "fecha_creacion", label: t("profiling.createdAt"), format: "fecha" },
          ]}
          backend={{
            list: db.getPerfilamientosComprador,
            getById: db.getPerfilamientoCompradorById,
            add: db.addPerfilamientoComprador,
            update: db.updatePerfilamientoComprador,
            remove: db.deletePerfilamientoComprador,
          }}
        />
      )}
    </div>
  );
}
