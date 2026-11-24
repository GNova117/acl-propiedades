// Genera public/og-default.png (la imagen de la marca para compartir enlaces). Se corre a mano cuando cambie el logo o el
// texto:  node scripts/build-og-image.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GlobalFonts, Path2D, createCanvas } from "@napi-rs/canvas";
import { brandImagePng, registerFonts } from "../server/ogImage.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
registerFonts(GlobalFonts, join(root, "server", "fonts"));
writeFileSync(join(root, "public", "og-default.png"), brandImagePng({ createCanvas, Path2D }));
console.log("public/og-default.png listo");
