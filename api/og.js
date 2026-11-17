// Imagen para compartir una propiedad (foto + precio + datos). Ver server/ogProperty.js. La usa middleware.js como
// og:image de /propiedades/:id.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GlobalFonts, Path2D, createCanvas, loadImage } from "@napi-rs/canvas";
import { registerFonts } from "../server/ogImage.js";
import { propertyOgResponse } from "../server/ogProperty.js";

let fontsReady = false;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).send("Method not allowed");
    return;
  }
  if (!fontsReady) {
    registerFonts(GlobalFonts, join(dirname(fileURLToPath(import.meta.url)), "..", "server", "fonts"));
    fontsReady = true;
  }
  const out = await propertyOgResponse({ id: req.query?.id, env: process.env, canvasApi: { createCanvas, Path2D }, loadImage });
  for (const [name, value] of Object.entries(out.headers)) res.setHeader(name, value);
  res.status(out.status).send(out.body);
}
