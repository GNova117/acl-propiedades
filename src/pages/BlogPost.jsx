import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import GuideBanner from "../components/GuideBanner";
import { db } from "../lib/dataStore";
import "./Blog.css";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";

const formatDate = (iso, locale) => new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-MX", { dateStyle: "long" });

export default function BlogPost() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    db.getBlogPostBySlug(slug)
      .then((data) => active && setPost(data))
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  const jsonLd = useMemo(() => {
    if (!post || typeof window === "undefined") return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt || undefined,
      image: post.cover_image || undefined,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: { "@type": "Organization", name: "ACL Propiedades" },
    };
  }, [post]);

  if (loading) return <LoadingState />;
  if (loadFailed) {
    return (
      <>
        <Seo title={t("loadError.title")} noindex />
        <EmptyState illustration="document" title={t("loadError.title")} text={t("loadError.text")}>
          <button type="button" className="btn btn-primary" onClick={() => setReloadKey((n) => n + 1)}>{t("loadError.retry")}</button>
        </EmptyState>
      </>
    );
  }
  if (!post) {
    return (
      <>
        <Seo title={t("blog.notFound")} noindex />
        <EmptyState illustration="document" title={t("emptyState.postGoneTitle")} text={t("blog.notFound")}>
          <Link to="/blog" className="btn btn-primary">{t("blog.back")}</Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Seo title={post.title} description={post.excerpt || undefined} image={post.cover_image || undefined} jsonLd={jsonLd} />

      <section className="section">
        <div className="container blog-post">
          <Link to="/blog" className="blog-post__back">{t("blog.back")}</Link>
          <p className="blog-post__date">{formatDate(post.published_at, i18n.language)}</p>
          <h1>{post.title}</h1>
          {post.cover_image && <img src={post.cover_image} alt="" className="blog-post__cover" decoding="async" />}
          <div className="blog-post__body">
            {post.body.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <GuideBanner className="guide-banner--post" />
        </div>
      </section>
    </>
  );
}
