import { describe, expect, it } from "vitest";
import { splitChatCodes } from "./chatLinks";

describe("splitChatCodes", () => {
  it("separa los códigos de propiedad del texto", () => {
    expect(splitChatCodes("Mira ACL-1001 y ACL-1004, te gustarán.")).toEqual([
      { text: "Mira " },
      { code: "ACL-1001" },
      { text: " y " },
      { code: "ACL-1004" },
      { text: ", te gustarán." },
    ]);
  });
  it("sin códigos devuelve el texto tal cual", () => {
    expect(splitChatCodes("Hola")).toEqual([{ text: "Hola" }]);
    expect(splitChatCodes("")).toEqual([]);
    expect(splitChatCodes(null)).toEqual([]);
  });
  it("no toma como código algo que no lo es", () => {
    expect(splitChatCodes("XACL-1001 o ACL-12")).toEqual([{ text: "XACL-1001 o ACL-12" }]);
  });
});
