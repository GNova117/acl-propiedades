import { describe, expect, it } from "vitest";
import { phoneActions } from "./searchActions";

describe("phoneActions", () => {
  it("da los enlaces de llamar y de WhatsApp del primer teléfono utilizable", () => {
    expect(phoneActions(["871 123 4567"])).toEqual({ phone: "871 123 4567", call: "tel:+528711234567", whatsapp: "https://wa.me/528711234567" });
  });

  it("salta los vacíos y los números incompletos", () => {
    expect(phoneActions([null, "", "123", "871-555-0101"]).phone).toBe("871-555-0101");
  });

  it("respeta un número que ya trae la lada de país", () => {
    expect(phoneActions(["+52 1 871 123 4567"]).call).toBe("tel:+5218711234567");
  });

  it("sin teléfono utilizable no hay atajos", () => {
    expect(phoneActions()).toBeNull();
    expect(phoneActions([])).toBeNull();
    expect(phoneActions([null, "12345"])).toBeNull();
  });
});
