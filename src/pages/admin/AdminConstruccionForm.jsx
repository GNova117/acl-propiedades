import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/dataStore";
import "./admin.css";

export default function AdminConstruccionForm() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await db.addConstruccionProyecto({ nombre: nombre.trim(), cliente: cliente.trim(), direccion: direccion.trim() });
      navigate(`/admin/construccion/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Nuevo proyecto de construcción</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="construccion-nombre">Nombre</label>
          <input id="construccion-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required />
        </div>
        <div className="form-field">
          <label htmlFor="construccion-cliente">Cliente (opcional)</label>
          <input id="construccion-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="construccion-direccion">Dirección (opcional)</label>
          <input id="construccion-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Creando…" : "Crear y abrir editor"}
        </button>
      </form>
    </div>
  );
}
