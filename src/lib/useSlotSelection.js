import { useMemo, useState } from "react";
import { groupSlotsByDate } from "./visitSlots";

// Estado del selector: los días con horarios libres y el día/hora elegidos.
// Lo elegido solo vale mientras siga existiendo en `slots` (la lista puede
// cambiar al volver a pedirla): si el día ya no está se usa el primero y si la
// hora ya no está se queda sin elegir. `onPickTime` avisa cada vez que se elige una hora.
export function useSlotSelection(slots, onPickTime) {
  const days = useMemo(() => groupSlotsByDate(slots), [slots]);
  const [pickedDate, setPickedDate] = useState("");
  const [pickedTime, setPickedTime] = useState("");

  const activeDay = days.find((d) => d.fecha === pickedDate) || days[0];
  const activeDate = activeDay?.fecha || "";
  const activeTime = activeDay?.horas.includes(pickedTime) ? pickedTime : "";

  return {
    days,
    activeDay,
    activeDate,
    activeTime,
    pickDate: (fecha) => {
      setPickedDate(fecha);
      setPickedTime("");
    },
    pickTime: (hora) => {
      setPickedTime(hora);
      onPickTime?.(hora);
    },
    clearTime: () => setPickedTime(""),
  };
}
