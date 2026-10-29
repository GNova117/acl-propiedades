// Torre de ejemplo para el modo demo (sin Supabase). Las imágenes son
// ilustraciones SVG generadas aquí mismo — no hay fotos reales ni dependencias
// de red — y se rotulan "Imagen ilustrativa". En producción cada torre trae sus
// renders o fotos reales, subidas desde /admin/desarrollos.

const svgUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

const CAPTION = (text) =>
  `<text x="600" y="776" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" fill="#ffffff" fill-opacity="0.75">${text}</text>`;

function towerArt(title) {
  const windows = [];
  for (let row = 0; row < 14; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = (row * 7 + col * 3) % 5 !== 0;
      windows.push(
        `<rect x="${430 + col * 56}" y="${150 + row * 42}" width="38" height="26" rx="2" fill="${lit ? "#ffe9a8" : "#8fb4d9"}" fill-opacity="${lit ? 0.92 : 0.55}"/>`
      );
    }
  }
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0d3b73"/><stop offset="0.6" stop-color="#2f9bdc"/><stop offset="1" stop-color="#f6c28b"/>
        </linearGradient>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#e9eef5"/><stop offset="1" stop-color="#b9c6d8"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#sky)"/>
      <rect x="40" y="430" width="150" height="300" fill="#0d3b73" fill-opacity="0.55"/>
      <rect x="200" y="360" width="120" height="370" fill="#0d3b73" fill-opacity="0.45"/>
      <rect x="890" y="400" width="140" height="330" fill="#0d3b73" fill-opacity="0.5"/>
      <rect x="1040" y="470" width="130" height="260" fill="#0d3b73" fill-opacity="0.4"/>
      <rect x="410" y="110" width="380" height="640" fill="url(#body)"/>
      <rect x="440" y="80" width="320" height="34" fill="#0d3b73"/>
      ${windows.join("")}
      <rect x="500" y="690" width="200" height="60" fill="#0d3b73"/>
      <rect x="0" y="750" width="1200" height="50" fill="#0a0e14" fill-opacity="0.65"/>
      <text x="600" y="62" text-anchor="middle" font-family="Rajdhani,Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="8" fill="#ffffff">${title}</text>
      ${CAPTION("Imagen ilustrativa")}
    </svg>`);
}

function roomArt(label, wall, floor) {
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="${wall}"/>
      <rect y="560" width="1200" height="240" fill="${floor}"/>
      <rect x="720" y="110" width="360" height="330" fill="#cfe6f7" stroke="#ffffff" stroke-width="14"/>
      <rect x="720" y="110" width="360" height="330" fill="#ffffff" fill-opacity="0.0" stroke="#ffffff" stroke-width="6" stroke-dasharray="0"/>
      <line x1="900" y1="110" x2="900" y2="440" stroke="#ffffff" stroke-width="10"/>
      <rect x="130" y="400" width="470" height="170" rx="22" fill="#34506f"/>
      <rect x="130" y="350" width="470" height="90" rx="22" fill="#436286"/>
      <rect x="170" y="590" width="390" height="110" rx="10" fill="#f4f1ea"/>
      <circle cx="640" cy="620" r="34" fill="#2e7d5b"/>
      <rect x="628" y="640" width="24" height="70" fill="#6a4a2e"/>
      <text x="600" y="62" text-anchor="middle" font-family="Rajdhani,Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="6" fill="#0d3b73">${label}</text>
      ${CAPTION("Imagen ilustrativa").replace('fill="#ffffff" fill-opacity="0.75"', 'fill="#0d3b73" fill-opacity="0.7"')}
    </svg>`);
}

function planArt(label, rooms) {
  const cells = rooms
    .map(
      ([name, x, y, w, h]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#0d3b73" stroke-width="5"/>
         <text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" fill="#0d3b73">${name}</text>`
    )
    .join("");
  return svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#f4f6f9"/>
      <text x="600" y="64" text-anchor="middle" font-family="Rajdhani,Arial,sans-serif" font-size="32" font-weight="700" letter-spacing="6" fill="#0d3b73">${label}</text>
      <g transform="translate(120 110)">${cells}</g>
      <text x="600" y="776" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" fill="#0d3b73" fill-opacity="0.7">Plano esquemático, sin escala</text>
    </svg>`);
}

const MODELS = [
  {
    key: "a",
    name: "Modelo A",
    area_m2: 62,
    bedrooms: 1,
    bathrooms: 1,
    parking: 1,
    description: "Una recámara con terraza. Ideal para vivir solo o como inversión de renta.",
    images: [roomArt("MODELO A · SALA", "#eef3f8", "#c9b79c")],
    plan_image: planArt("MODELO A · 62 m²", [
      ["Sala-comedor", 0, 0, 520, 300],
      ["Cocina", 520, 0, 260, 160],
      ["Baño", 520, 160, 260, 140],
      ["Recámara", 0, 300, 400, 260],
      ["Terraza", 400, 300, 380, 260],
    ]),
  },
  {
    key: "b",
    name: "Modelo B",
    area_m2: 88,
    bedrooms: 2,
    bathrooms: 2,
    parking: 2,
    description: "Dos recámaras con vestidor en la principal y balcón corrido.",
    images: [roomArt("MODELO B · SALA", "#f1efe9", "#b8a384")],
    plan_image: planArt("MODELO B · 88 m²", [
      ["Sala-comedor", 0, 0, 480, 320],
      ["Cocina", 480, 0, 300, 170],
      ["Baño", 480, 170, 150, 150],
      ["Cuarto serv.", 630, 170, 150, 150],
      ["Recámara 2", 0, 320, 330, 240],
      ["Recámara principal", 330, 320, 450, 240],
    ]),
  },
  {
    key: "c",
    name: "Modelo C",
    area_m2: 104,
    bedrooms: 2,
    bathrooms: 2.5,
    parking: 2,
    description: "El más amplio de piso regular: dos recámaras, cuarto de estudio y cocina abierta.",
    images: [roomArt("MODELO C · SALA", "#e9eff1", "#a89478")],
    plan_image: planArt("MODELO C · 104 m²", [
      ["Sala", 0, 0, 380, 300],
      ["Comedor", 380, 0, 220, 300],
      ["Cocina", 600, 0, 180, 300],
      ["Estudio", 0, 300, 260, 260],
      ["Recámara 2", 260, 300, 260, 260],
      ["Recámara principal", 520, 300, 260, 260],
    ]),
  },
  {
    key: "ph",
    name: "Penthouse",
    area_m2: 168,
    bedrooms: 3,
    bathrooms: 3.5,
    parking: 3,
    description: "Último piso con terraza privada, tres recámaras y vista panorámica de la ciudad.",
    images: [roomArt("PENTHOUSE · SALA", "#f6f3ee", "#8d7a5e")],
    plan_image: planArt("PENTHOUSE · 168 m²", [
      ["Sala-comedor", 0, 0, 500, 330],
      ["Cocina", 500, 0, 280, 200],
      ["Terraza privada", 500, 200, 280, 130],
      ["Recámara 3", 0, 330, 260, 230],
      ["Recámara 2", 260, 330, 260, 230],
      ["Recámara principal", 520, 330, 260, 230],
    ]),
  },
];

// Pisos 1-9: cuatro deptos por piso (A, B, B, C). Piso 10: dos penthouses.
// Los precios suben con el piso; los primeros pisos ya están vendidos o
// apartados, como en una preventa con avance — todo determinístico.
function buildUnits() {
  const base = { a: 1750000, b: 2350000, c: 2850000, ph: 5600000 };
  const layout = ["a", "b", "b", "c"];
  const views = ["Norte", "Poniente", "Oriente", "Sur"];
  const units = [];
  for (let floor = 1; floor <= 9; floor += 1) {
    layout.forEach((model, index) => {
      const sequence = (floor - 1) * 4 + index;
      let status = "disponible";
      if (sequence < 14) status = "vendida";
      else if (sequence < 19 || sequence % 9 === 0) status = "apartada";
      units.push({
        number: `${floor}0${index + 1}`,
        floor,
        model,
        price: base[model] + (floor - 1) * 35000,
        status,
        view: views[index],
      });
    });
  }
  ["Panorámica norte", "Panorámica sur"].forEach((view, index) => {
    units.push({ number: `100${index + 1}`, floor: 10, model: "ph", price: base.ph + index * 150000, status: index === 0 ? "apartada" : "disponible", view });
  });
  return units;
}

export const DEVELOPMENTS_SEED = [
  {
    id: "dev-torre-aurora",
    slug: "torre-aurora",
    name: "Torre Aurora",
    tagline: "Departamentos con vista a la ciudad, a minutos del Paseo Colón",
    description:
      "Torre residencial de 10 niveles con departamentos de una a tres recámaras, terrazas y amenidades de uso exclusivo para los residentes.\n\nEste es un desarrollo de ejemplo para mostrar cómo se presenta una torre completa en el sitio.",
    zone: "Torreón",
    address: "Blvd. Independencia 1200, Torreón, Coahuila",
    lat: 25.5428,
    lng: -103.4068,
    stage: "preventa",
    delivery_date: "Diciembre 2027",
    developer_name: "Grupo Constructor Aurora",
    developer_logo: "",
    hero_image: towerArt("TORRE AURORA"),
    images: [towerArt("TORRE AURORA"), roomArt("LOBBY", "#e8eef5", "#9fb0c8")],
    amenities: ["Alberca en azotea", "Gimnasio", "Salón de eventos", "Vigilancia 24 h", "Elevadores", "Cajón de estacionamiento techado"],
    models: MODELS,
    units: buildUnits(),
    disclaimer: "",
    published: true,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
  },
];
