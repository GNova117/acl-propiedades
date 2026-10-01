import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";

const EMPTY = { title: "", excerpt: "", body: "", published: false };

export default function AdminBlogForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState(null);
  const [existingCover, setExistingCover] = useState("");
  const [removeCover, setRemoveCover] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    db.getBlogPosts().then((posts) => {
      const post = posts.find((p) => p.id === id);
      if (!post) return;
      setExisting(post);
      setForm({ title: post.title, excerpt: post.excerpt || "", body: post.body, published: post.published });
      setExistingCover(post.cover_image || "");
      setLoading(false);
    });
  }, [id, isEdit]);

  useEffect(() => {
    if (coverFile) {
      const url = URL.createObjectURL(coverFile);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(removeCover ? "" : existingCover);
    return undefined;
  }, [coverFile, existingCover, removeCover]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = t("contact.required");
    if (!form.body.trim()) next.body = t("contact.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, coverFile, removeCover };
      if (isEdit) {
        await db.updateBlogPost(id, payload, existing);
      } else {
        await db.addBlogPost(payload);
      }
      navigate("/admin/blog");
    } catch (err) {
      window.alert(err.message || "Error al guardar el artículo");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("blog.admin.edit") : t("blog.admin.new")}</h1>
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate style={{ maxWidth: 720 }}>
        <div className="form-field">
          <label htmlFor="blog-title">{t("blog.admin.fields.title")}</label>
          <input id="blog-title" value={form.title} onChange={handleChange("title")} />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="blog-excerpt">{t("blog.admin.fields.excerpt")}</label>
          <textarea id="blog-excerpt" rows={2} value={form.excerpt} onChange={handleChange("excerpt")} />
          <p className="form-hint">{t("blog.admin.fields.excerptHint")}</p>
        </div>

        <div className="form-field">
          <label htmlFor="blog-body">{t("blog.admin.fields.body")}</label>
          <textarea id="blog-body" rows={14} value={form.body} onChange={handleChange("body")} />
          {errors.body && <span className="form-error">{errors.body}</span>}
        </div>

        <div className="form-field">
          <label>{t("blog.admin.fields.cover")}</label>
          {preview && (
            <div style={{ marginBottom: "0.75rem" }}>
              <img src={preview} alt="" style={{ width: "100%", maxWidth: 360, borderRadius: 8, objectFit: "cover" }} />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  setCoverFile(null);
                  setRemoveCover(true);
                }}
              >
                {t("blog.admin.fields.removeCover")}
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setCoverFile(e.target.files?.[0] || null);
              setRemoveCover(false);
            }}
          />
        </div>

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.published} onChange={handleChange("published")} style={{ marginRight: "0.5rem" }} />
            {t("blog.admin.fields.published")}
          </label>
          <p className="form-hint">{t("blog.admin.fields.publishedHint")}</p>
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/blog")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
