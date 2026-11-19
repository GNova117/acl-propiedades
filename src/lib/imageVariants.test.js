import { describe, expect, it } from "vitest";
import { VARIANT_WIDTHS, hasVariants, markVariantName, responsiveProps, variantUrl } from "./imageVariants";

const BASE = "https://x.supabase.co/storage/v1/object/public/property-images";

describe("imageVariants", () => {
  it("solo las fotos subidas con la marca _rs tienen copias", () => {
    expect(hasVariants(`${BASE}/1700-ab12-casa_rs.jpg`)).toBe(true);
    expect(hasVariants(`${BASE}/1700-ab12-casa_rs.jpg?v=2`)).toBe(true);
    expect(hasVariants(`${BASE}/1700-ab12-casa.jpg`)).toBe(false);
    expect(hasVariants(`${BASE}/casa_rs_vieja.jpg`)).toBe(false);
    expect(hasVariants("data:image/png;base64,AAA_rs.png")).toBe(false);
    expect(hasVariants("/img/local_rs.jpg")).toBe(false);
    expect(hasVariants(null)).toBe(false);
  });

  it("arma la dirección de cada copia conservando parámetros", () => {
    expect(variantUrl(`${BASE}/a_rs.jpg`, 480)).toBe(`${BASE}/a_rs.w480.webp`);
    expect(variantUrl(`${BASE}/a_rs.jpeg?x=1#y`, 960)).toBe(`${BASE}/a_rs.w960.webp?x=1#y`);
  });

  it("pone la marca antes de la extensión", () => {
    expect(markVariantName("casa.jpg")).toBe("casa_rs.jpg");
    expect(markVariantName("foto.final.PNG")).toBe("foto.final_rs.PNG");
    expect(markVariantName("sinextension")).toBe("sinextension_rs");
  });

  it("con copias da srcSet y sizes; sin ellas, solo src", () => {
    const withCopies = responsiveProps(`${BASE}/a_rs.jpg`, "(max-width: 640px) 100vw, 400px");
    expect(withCopies.src).toBe(`${BASE}/a_rs.w960.webp`);
    expect(withCopies.srcSet).toBe(`${BASE}/a_rs.w480.webp 480w, ${BASE}/a_rs.w960.webp 960w, ${BASE}/a_rs.jpg 1920w`);
    expect(withCopies.sizes).toBe("(max-width: 640px) 100vw, 400px");
    expect(responsiveProps(`${BASE}/vieja.jpg`, "100vw")).toEqual({ src: `${BASE}/vieja.jpg` });
    expect(responsiveProps(`${BASE}/a_rs.jpg`).sizes).toBe("100vw");
  });

  it("los anchos son los esperados", () => {
    expect(VARIANT_WIDTHS).toEqual([480, 960]);
  });
});
