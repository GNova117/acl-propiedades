import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";

const formatDate = (iso, locale) => new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-MX", { dateStyle: "long" });

export default function AdminBlog() {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getBlogPosts().then((data) => {
      setPosts(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDelete = async (post) => {
    if (!await confirmDialog(t("common.confirmDelete"))) return;
    setDeletingId(post.id);
    try {
      await db.deleteBlogPost(post.id);
      load();
    } catch (err) {
      notify(err.message || "Error al eliminar el artículo");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("blog.admin.title")}</h1>
        <div className="admin-header__actions">
          <Link to="/admin/blog/nuevo" className="btn btn-primary">
            {t("blog.admin.new")}
          </Link>
        </div>
      </div>
      <p className="form-hint mt-n3 mb-5">{t("blog.admin.subtitle")}</p>

      {loading ? (
        <LoadingState variant="lines" />
      ) : posts.length === 0 ? (
        <p className="form-hint">{t("blog.admin.empty")}</p>
      ) : (
        <div className="admin-zones-grid">
          {posts.map((post) => (
            <div key={post.id} className="card admin-zone-card">
              {post.cover_image && <img src={post.cover_image} alt="" className="admin-zone-card__thumb" />}
              <h3>{post.title}</h3>
              <span className={`badge ${post.published ? "badge-available" : "badge-sold"}`}>
                {post.published ? t("blog.admin.published") : t("blog.admin.draft")}
              </span>
              <p className="form-hint mt-2">
                {post.published_at
                  ? t("blog.admin.publishedOn", { date: formatDate(post.published_at, i18n.language) })
                  : t("blog.admin.notPublishedYet")}
              </p>
              <div className="admin-zone-card__row">
                <Link to={`/admin/blog/${post.id}`} className="btn btn-outline btn-sm">
                  {t("common.edit")}
                </Link>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(post)}
                  disabled={deletingId === post.id}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
