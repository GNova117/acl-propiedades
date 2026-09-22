import { useParams } from "react-router-dom";
import RoomEditor from "../../components/construccion/room-editor";
import "./AdminConstruccion.css";

export default function AdminConstruccionProject() {
  const { id } = useParams();
  return <RoomEditor proyectoId={id} />;
}
