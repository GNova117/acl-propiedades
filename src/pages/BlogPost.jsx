import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import GuideBanner from "../components/GuideBanner";
import { db } from "../lib/dataStore";
import "./Blog.css";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { articleJsonLd } from "../lib/structuredData";
import { readingMinutes } from "../lib/readingTime";
import { parseBlogBody } from "../lib/blogMarkdown";
import { siteOrigin } from "../lib/site";
import ShareButton from "../components/ShareButton";

const formatDate = (iso, locale) => new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-MX", { dateStyle: "long" });

// Texto en línea del artículo: enlaces internos con <Link>, externos en pestaña nueva, negritas.
function Inline({ parts }) {
  return parts.map((part, i) => {
    if (part.type === "bold") return <strong key={i}>{part.text}</strong>;
    if (part.type !== "link") return <span key={i}>{part.text}</span>;
    return part.external || part.href.startsWith("mailto:") || part.href.startsWith("tel:") ? (
      <a key={i} href={part.href} target={part.external ? "_blank" : undefined} rel={part.external ? "noopener noreferrer" : undefined}>
        {part.text}
      </a>
    ) : (
      <Link key={i} to={part.href}>
        {part.text}
      </Link>
    );
  });
}

function BlogBlock({ block }) {
  if (block.type === "heading") {
    const Tag = block.level === 2 ? "h2" : "h3";
    return (
      <Tag>
        <Inline parts={block.inline} />
      </Tag>
    );
  }
  if (block.type === "image") return <img src={block.src} alt={block.alt} loading="lazy" decoding="async" className="blog-post__figure" />;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List>
        {block.items.map((item, i) => (
          <li key={i}>
            <Inline parts={item} />
          </li>
        ))}
      </List>
    );
  }
  return (
    <p>
      <Inline parts={block.inline} />
    </p>
  );
}

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

  // Otros artículos publicados (los más recientes): para seguir leyendo.
  const [related, setRelated] = useState([]);
  useEffect(() => {
    if (!post) return undefined;
    let active = true;
    db.getBlogPosts({ publishedOnly: true })
      .then((posts) => active && setRelated(posts.filter((p) => p.id !== post.id).slice(0, 3)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [post]);

  const jsonLd = useMemo(() => {
    if (!post || typeof window === "undefined") return undefined;
    return articleJsonLd({ post, url: `${siteOrigin()}/blog/${slug}`, siteUrl: siteOrigin() });
  }, [post, slug]);

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
          {i18n.resolvedLanguage === "en" && <p className="form-hint" role="note">{t("blog.spanishOnly")}</p>}
          <p className="blog-post__date">
            {formatDate(post.published_at, i18n.language)} · {t("blog.readTime", { count: readingMinutes(post.body) })} · {t("blog.byline")}
          </p>
          <h1>{post.title}</h1>
          {post.cover_image && <img src={post.cover_image} alt="" className="blog-post__cover" decoding="async" />}
          <div className="blog-post__body" lang="es">
            {parseBlogBody(post.body).map((block, i) => (
              <BlogBlock key={i} block={block} />
            ))}
          </div>
          <div className="blog-post__share">
            <ShareButton title={post.title} url={`${siteOrigin()}/blog/${slug}`} openUpward />
          </div>
          <GuideBanner className="guide-banner--post" />
          {related.length > 0 && (
            <nav className="blog-post__related" aria-labelledby="blog-related-title">
              <h2 id="blog-related-title">{t("blog.related")}</h2>
              <ul>
                {related.map((item) => (
                  <li key={item.id}>
                    <Link to={`/blog/${item.slug}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
