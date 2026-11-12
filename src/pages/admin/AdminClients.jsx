import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { exportToCsv } from "../../lib/csvExport";
import ClientPdfModal from "../../components/ClientPdfModal";
import BulkActionsBar from "../../components/BulkActionsBar";
import AdminFilters from "../../components/AdminFilters";
import RowMore from "../../components/RowMore";
import { FINANCIAMIENTO_TYPES } from "../../lib/format";
import { telHref, whatsappLink } from "../../lib/prospectActions";
import { queries } from "../../lib/queries";
import { useQuery } from "../../lib/useQuery";
import "./admin.css";

function clientTypeLabel(t, type) {
  return t(`clients.${type === "comprador" ? "buyer" : type === "vendedor" ? "seller" : "both"}`);
}

function financiamientoLabel(t, value) {
  return value ? t(`clients.financiamientoOptions.${value}`) : "—";
}

const NONE = [];

export default function AdminClients() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [financiamientoFilter, setFinanciamientoFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // La lista sale del caché (ver dataCache.js): si ya se pidió en otra pantalla, se pinta al instante
  // y se actualiza al llegar lo nuevo. Cada filtro de tipo tiene su propia entrada.
  const clientsQ = useQuery(queries.clients(typeFilter));
  const clients = clientsQ.data ?? NONE;
  const loading = clientsQ.loading;
  const load = () => clientsQ.reload().catch(() => {});

  const months = t("dateFilter.months", { returnObjects: true });

  const years = useMemo(() => {
    const set = new Set(clients.filter((c) => c.created_at).map((c) => new Date(c.created_at).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [clients]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (term && !c.name?.toLowerCase().includes(term) && !c.phone?.includes(term)) return false;
      if (financiamientoFilter && c.financiamiento !== financiamientoFilter) return false;
      if (!c.created_at && (monthFilter || yearFilter)) return false;
      if (monthFilter || yearFilter) {
        const d = new Date(c.created_at);
        if (monthFilter && d.getMonth() + 1 !== Number(monthFilter)) return false;
        if (yearFilter && d.getFullYear() !== Number(yearFilter)) return false;
      }
      return true;
    });
  }, [clients, search, financiamientoFilter, monthFilter, yearFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteClient(id);
    load();
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filteredClients.length > 0 && filteredClients.every((c) => selected.has(c.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredClients.forEach((c) => (allVisibleSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  };

  // Una por una, no en paralelo — ver la misma nota en AdminProperties.jsx:
  // el backend de modo demo no es seguro para escrituras concurrentes.
  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(t("bulkActions.deleteConfirm", { count: ids.length }))) return;
    setBulkBusy(true);
    let failed = false;
    try {
      for (const id of ids) {
        try {
          await db.deleteClient(id);
        } catch {
          failed = true;
        }
      }
      if (failed) window.alert(t("bulkActions.someFailed"));
      setSelected(new Set());
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = () => {
    exportToCsv("clientes.csv", filteredClients, [
      { label: t("clients.name"), key: "name" },
      { label: t("clients.type"), value: (c) => clientTypeLabel(t, c.type) },
      { label: t("clients.financiamiento"), value: (c) => financiamientoLabel(t, c.financiamiento) },
      { label: t("clients.phone"), key: "phone" },
      { label: t("clients.email"), key: "email" },
      { label: t("clients.notes"), key: "notes" },
      { label: t("messages.date"), value: (c) => (c.created_at ? new Date(c.created_at).toLocaleDateString("es-MX") : "") },
    ]);
  };

  const activeFilters = [typeFilter, financiamientoFilter, monthFilter, yearFilter].filter(Boolean).length;

  return (
    <div>
      <div className="admin-header">
        <h1>{t("clients.title")}</h1>
        <div className="admin-header__actions">
          <Link to="/admin/clientes/nuevo" className="btn btn-primary">
            {t("admin.newClient")}
          </Link>
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={filteredClients.length === 0}>
            {t("common.exportCsv")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setShowPdfModal(true)}>
            {t("clients.downloadPdf")}
          </button>
        </div>
      </div>

      {showPdfModal && <ClientPdfModal initialTypeFilter={typeFilter} onClose={() => setShowPdfModal(false)} />}

      <AdminFilters
        activeCount={activeFilters}
        search={
          <div className="form-field">
            <label htmlFor="client-search">{t("common.search")}</label>
            <input
              id="client-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("clients.searchPlaceholder")}
            />
          </div>
        }
      >
        <div className="form-field">
          <label htmlFor="client-type-filter">{t("clients.type")}</label>
          <select id="client-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">—</option>
            <option value="comprador">{t("clients.buyer")}</option>
            <option value="vendedor">{t("clients.seller")}</option>
            <option value="ambos">{t("clients.both")}</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="client-financiamiento-filter">{t("clients.financiamiento")}</label>
          <select
            id="client-financiamiento-filter"
            value={financiamientoFilter}
            onChange={(e) => setFinanciamientoFilter(e.target.value)}
          >
            <option value="">—</option>
            {FINANCIAMIENTO_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`clients.financiamientoOptions.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="client-month-filter">{t("dateFilter.month")}</label>
          <select id="client-month-filter" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">{t("dateFilter.allMonths")}</option>
            {months.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="client-year-filter">{t("dateFilter.year")}</label>
          <select id="client-year-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">{t("dateFilter.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </AdminFilters>

      <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())} busy={bulkBusy}>
        <button type="button" className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkBusy}>
          {t("bulkActions.deleteSelected")}
        </button>
      </BulkActionsBar>

      {/* En el teléfono cada fila es una tarjeta (ver admin-table--cards en admin.css). */}
      <div className="card admin-table-wrapper admin-table-wrapper--cards">
        <table className="admin-table admin-table--cards admin-table--clients">
          <thead>
            <tr>
              <th className="cell-select" data-label={t("bulkActions.selectAll")}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label={t("bulkActions.selectAll")}
                />
              </th>
              <th>{t("clients.name")}</th>
              <th>{t("clients.type")}</th>
              <th>{t("clients.financiamiento")}</th>
              <th>{t("clients.phone")}</th>
              <th>{t("clients.email")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>{t("common.loading")}</td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={7}>{t("clients.noResults")}</td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const call = telHref(client.phone);
                const wa = whatsappLink(client.phone);
                return (
                  <tr key={client.id} className="admin-row">
                    <td className="cell-select">
                      <input
                        type="checkbox"
                        checked={selected.has(client.id)}
                        onChange={() => toggleOne(client.id)}
                        aria-label={t("bulkActions.selectRow")}
                      />
                    </td>
                    <td className="cell-name">{client.name}</td>
                    <td className="cell-type">{clientTypeLabel(t, client.type)}</td>
                    <td className={`cell-fin${client.financiamiento ? "" : " cell-empty"}`} data-label={t("clients.financiamiento")}>
                      {financiamientoLabel(t, client.financiamiento)}
                    </td>
                    <td className="cell-phone">{call ? <a href={call}>{client.phone}</a> : client.phone}</td>
                    <td className={`cell-email${client.email ? "" : " cell-empty"}`}>
                      {client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : null}
                    </td>
                    <td className="admin-table__actions cell-actions">
                      {call && (
                        <a href={call} className="btn btn-outline btn-sm show-on-phone">
                          {t("myDay.call")}
                        </a>
                      )}
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                          WhatsApp
                        </a>
                      )}
                      <Link to={`/admin/clientes/${client.id}`} className="btn btn-outline btn-sm">
                        {t("common.edit")}
                      </Link>
                      <RowMore>
                        <Link to={`/admin/clientes/${client.id}/historial`} className="btn btn-outline btn-sm">
                          {t("clientHistory.button")}
                        </Link>
                        <Link to={`/admin/clientes/${client.id}/perfilamiento`} className="btn btn-outline btn-sm">
                          {t("profiling.title")}
                        </Link>
                        <Link to={`/admin/clientes/${client.id}/documentos`} className="btn btn-outline btn-sm">
                          {t("clients.viewDocuments")}
                        </Link>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(client.id)}>
                          {t("common.delete")}
                        </button>
                      </RowMore>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
