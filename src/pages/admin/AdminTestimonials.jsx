import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import Stars from "../../components/Stars";
import "./admin.css";

const EMPTY_FORM = { name: "", role: "", quote: "", rating: 5 };

export default function AdminTestimonials() {
  const { t } = useTranslation();
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingId, setSavingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getTestimonials().then((data) => {
      setTestimonials(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newForm.name.trim() || !newForm.quote.trim()) return;
    setAdding(true);
    try {
      await db.addTestimonial(newForm);
      setNewForm(EMPTY_FORM);
      load();
    } catch (err) {
      window.alert(err.message || "Error al agregar el testimonio");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (testimonial) => {
    setEditingId(testimonial.id);
    setEditForm({ name: testimonial.name, role: testimonial.role || "", quote: testimonial.quote, rating: testimonial.rating });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name.trim() || !editForm.quote.trim()) return;
    setSavingId(id);
    try {
      await db.updateTestimonial(id, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      window.alert(err.message || "Error al guardar el testimonio");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (testimonial) => {
    setTogglingId(testimonial.id);
    try {
      await db.toggleTestimonialActive(testimonial.id, !testimonial.active);
      load();
    } catch (err) {
      window.alert(err.message || "Error al cambiar el estado del testimonio");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setDeletingId(id);
    try {
      await db.deleteTestimonial(id);
      load();
    } catch (err) {
      window.alert(err.message || "Error al eliminar el testimonio");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("testimonials.title")}</h1>
      </div>
      <p className="form-hint" style={{ marginTop: "-0.75rem", marginBottom: "1.25rem" }}>{t("testimonials.subtitle")}</p>

      <form className="card admin-form" onSubmit={handleAdd} style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
        <h2 className="profiling-section-title">{t("testimonials.new")}</h2>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="testimonial-new-name">{t("testimonials.name")}</label>
            <input id="testimonial-new-name" value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))} placeholder="Laura Martínez" />
          </div>
          <div className="form-field">
            <label htmlFor="testimonial-new-role">{t("testimonials.role")}</label>
            <input id="testimonial-new-role" value={newForm.role} onChange={(e) => setNewForm((p) => ({ ...p, role: e.target.value }))} placeholder="Compradora en Torreón" />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="testimonial-new-rating">{t("testimonials.rating")}</label>
          <select id="testimonial-new-rating" value={newForm.rating} onChange={(e) => setNewForm((p) => ({ ...p, rating: Number(e.target.value) }))}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} / 5</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="testimonial-new-quote">{t("testimonials.quote")}</label>
          <textarea id="testimonial-new-quote" rows={3} value={newForm.quote} onChange={(e) => setNewForm((p) => ({ ...p, quote: e.target.value }))} />
        </div>
        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={adding || !newForm.name.trim() || !newForm.quote.trim()}>
            {adding ? <span className="spinner" /> : null}
            {t("testimonials.new")}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="form-hint">{t("common.loading")}</p>
      ) : testimonials.length === 0 ? (
        <p className="form-hint">{t("testimonials.noResults")}</p>
      ) : (
        <div className="admin-zones-grid">
          {testimonials.map((testimonial) => {
            const isEditing = editingId === testimonial.id;
            return (
              <div key={testimonial.id} className="card admin-zone-card">
                {isEditing ? (
                  <>
                    <div className="form-field">
                      <label>{t("testimonials.name")}</label>
                      <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>{t("testimonials.role")}</label>
                      <input value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>{t("testimonials.rating")}</label>
                      <select value={editForm.rating} onChange={(e) => setEditForm((p) => ({ ...p, rating: Number(e.target.value) }))}>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{n} / 5</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>{t("testimonials.quote")}</label>
                      <textarea rows={3} value={editForm.quote} onChange={(e) => setEditForm((p) => ({ ...p, quote: e.target.value }))} />
                    </div>
                    <div className="admin-zone-card__row">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(testimonial.id)} disabled={savingId === testimonial.id}>
                        {t("common.save")}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{testimonial.name}</h3>
                    {testimonial.role && <p className="form-hint" style={{ marginTop: "-0.5rem" }}>{testimonial.role}</p>}
                    <Stars rating={testimonial.rating} />
                    <p style={{ margin: "0.75rem 0" }}>&ldquo;{testimonial.quote}&rdquo;</p>
                    <div className="admin-zone-card__row">
                      <button
                        type="button"
                        className={`badge ${testimonial.active ? "badge-available" : "badge-sold"}`}
                        onClick={() => handleToggleActive(testimonial)}
                        disabled={togglingId === testimonial.id}
                      >
                        {testimonial.active ? t("common.active") : t("common.inactive")}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(testimonial)}>
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(testimonial.id)}
                        disabled={deletingId === testimonial.id}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
