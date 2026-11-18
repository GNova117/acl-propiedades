import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResponsiveImg from "./ResponsiveImg.jsx";

const BASE = "https://x.supabase.co/storage/v1/object/public/property-images";
const render = (props) => renderToStaticMarkup(createElement(ResponsiveImg, props));

describe("ResponsiveImg", () => {
  it("una foto con copias lleva srcset y sizes (y conserva sus demás atributos)", () => {
    const html = render({ src: `${BASE}/a_rs.jpg`, sizes: "96px", alt: "Fachada", loading: "lazy", className: "thumb" });
    expect(html).toContain(`srcSet="${BASE}/a_rs.w480.webp 480w, ${BASE}/a_rs.w960.webp 960w, ${BASE}/a_rs.jpg 1920w"`);
    expect(html).toContain('sizes="96px"');
    expect(html).toContain(`src="${BASE}/a_rs.w960.webp"`);
    expect(html).toContain('alt="Fachada"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('class="thumb"');
  });

  it("una foto anterior (sin copias) se queda como un <img> normal", () => {
    const html = render({ src: `${BASE}/vieja.jpg`, sizes: "96px", alt: "" });
    expect(html).toContain(`src="${BASE}/vieja.jpg"`);
    expect(html).not.toContain("srcSet");
    expect(html).not.toContain("sizes=");
  });
});
