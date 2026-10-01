import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import Reveal from "../components/Reveal";
import { db } from "../lib/dataStore";
import "./Blog.css";

const formatDate = (iso, locale) => new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-MX", { dateStyle: "long" });

export default function Blog() {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getBlogPosts({ publishedOnly: true })
      .then((data) => active && setPosts(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Seo title={t("blog.title")} description={t("blog.seoDescription")} />

      <section className="section">
        <div className="container">
          <Reveal className="section-heading">
            <span className="section-heading__eyebrow">{t("blog.eyebrow")}</span>
            <h1>{t("blog.title")}</h1>
            <p>{t("blog.subtitle")}</p>
          </Reveal>

          {loading ? (
            <p className="form-hint">{t("common.loading")}</p>
          ) : posts.length === 0 ? (
            <p className="empty-state">{t("blog.empty")}</p>
          ) : (
            <div className="blog-grid">
              {posts.map((post, index) => (
                <Reveal key={post.id} delay={(index % 6) * 70}>
                  <Link to={`/blog/${post.slug}`} className="card blog-card">
                    {post.cover_image ? (
                      <img src={post.cover_image} alt="" className="blog-card__image" />
                    ) : (
                      <div className="blog-card__image blog-card__image--placeholder" />
                    )}
                    <div className="blog-card__body">
                      <p className="blog-card__date">{formatDate(post.published_at, i18n.language)}</p>
                      <h2 className="blog-card__title">{post.title}</h2>
                      {post.excerpt && <p className="blog-card__excerpt">{post.excerpt}</p>}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
