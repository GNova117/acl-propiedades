import { Navigate, useSearchParams } from "react-router-dom";
import { shareToDraft } from "../../lib/quickProspect";

// Destino de «Compartir → ACL Panel» (share_target del manifest; Android con la app instalada): lo compartido desde WhatsApp,
// Contactos, etc. llega como ?title=&text=&url=. Se convierte en un borrador (lib/quickProspect.js: nombre y teléfono si se
// reconocen, y todo el texto para las notas) y se abre el «Prospecto rápido» con eso ya puesto (QuickCapture lo recibe en
// ?captura=prospecto). Solo con el apartado de prospectos (lo pide la ruta).
export default function AdminShare() {
  const [params] = useSearchParams();
  const draft = shareToDraft({ title: params.get("title") || "", text: params.get("text") || "", url: params.get("url") || "" });
  const target = new URLSearchParams({ captura: "prospecto" });
  if (draft.name) target.set("nombre", draft.name);
  if (draft.phone) target.set("telefono", draft.phone);
  if (draft.pasted) target.set("texto", draft.pasted);
  return <Navigate to={`/admin/prospectos?${target}`} replace />;
}
