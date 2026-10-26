import { describe, expect, it } from "vitest";
import { pickVideoTours, posterFrameUrl } from "./videoTours";

const prop = (id, createdDaysAgo, extra = {}) => ({
  id,
  status: "disponible",
  active: true,
  videos: [`https://cdn/${id}.mp4`],
  created_at: new Date(Date.UTC(2026, 9, 26) - createdDaysAgo * 86400000).toISOString(),
  ...extra,
});

describe("pickVideoTours", () => {
  it("toma solo disponibles activas con video, las más recientes primero, con su primer video", () => {
    const list = [
      prop("vieja", 90),
      prop("nueva", 2),
      prop("sinVideo", 1, { videos: [] }),
      prop("sinCampo", 1, { videos: undefined }),
      prop("vendida", 1, { status: "vendida" }),
      prop("inactiva", 1, { active: false }),
      prop("vacio", 1, { videos: ["", null] }),
      prop("dos", 5, { videos: ["", "https://cdn/segundo.mp4", "https://cdn/tercero.mp4"] }),
    ];
    const tours = pickVideoTours(list);
    expect(tours.map((t) => t.property.id)).toEqual(["nueva", "dos", "vieja"]);
    expect(tours[1].src).toBe("https://cdn/segundo.mp4");
  });

  it("respeta el límite y tolera listas vacías", () => {
    const list = Array.from({ length: 12 }, (_, i) => prop(`p${i}`, i));
    expect(pickVideoTours(list, { limit: 4 })).toHaveLength(4);
    expect(pickVideoTours(undefined)).toEqual([]);
  });
});

describe("posterFrameUrl", () => {
  it("agrega el fragmento de tiempo salvo que la URL ya tenga uno", () => {
    expect(posterFrameUrl("https://cdn/a.mp4")).toBe("https://cdn/a.mp4#t=0.1");
    expect(posterFrameUrl("https://cdn/a.mp4#t=2")).toBe("https://cdn/a.mp4#t=2");
  });
});
