import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import "./admin.css";

// Sin react-i18next a propósito: herramienta interna para staff hispanohablante,
// traducir jerga de construcción al inglés no aporta (ver docs/PLAN.md del port).
export default function AdminConstruccionProjects() {
  const { isDemoMode } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    db.getConstruccionProyectos()
      .then(setProyectos)
      .finally(() => setLoading(false));
  };

  useEffect(load, [isDemoMode]);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este proyecto? No se puede deshacer.")) return;
    await db.deleteConstruccionProyecto(id);
    load();
  };

  if (isDemoMode) {
    return <p className="empty-state">Este módulo requiere Supabase conectado (sin credenciales configuradas, estás en modo demo).</p>;
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Construcción</h1>
        <Link to="/admin/construccion/nuevo" className="btn btn-primary">
          + Nuevo proyecto
        </Link>
      </div>

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cliente</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Cargando…</td>
              </tr>
            ) : proyectos.length === 0 ? (
              <tr>
                <td colSpan={4}>Todavía no hay proyectos.</td>
              </tr>
            ) : (
              proyectos.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.cliente || "—"}</td>
                  <td>{p.direccion || "—"}</td>
                  <td className="admin-table__actions">
                    <Link to={`/admin/construccion/${p.id}`} className="btn btn-outline btn-sm">
                      Abrir
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
