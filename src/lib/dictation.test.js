import { describe, expect, it } from "vitest";
import { appendDictation, dictationSupported, finalTranscript, getRecognitionCtor } from "./dictation";

describe("dictation", () => {
  it("detecta si el navegador trae reconocimiento de voz", () => {
    class Fake {}
    expect(getRecognitionCtor({})).toBeNull();
    expect(dictationSupported({})).toBe(false);
    expect(getRecognitionCtor({ webkitSpeechRecognition: Fake })).toBe(Fake);
    expect(getRecognitionCtor({ SpeechRecognition: Fake })).toBe(Fake);
    expect(dictationSupported({ SpeechRecognition: Fake })).toBe(true);
  });

  it("agrega lo dictado con un espacio y respeta el tope", () => {
    expect(appendDictation("", "  hola   mundo ")).toBe("hola mundo");
    expect(appendDictation("Llamé", "no contestó")).toBe("Llamé no contestó");
    expect(appendDictation("Llamé ", "no contestó")).toBe("Llamé no contestó");
    expect(appendDictation("abc", "")).toBe("abc");
    expect(appendDictation("abc", "defghi", 6)).toBe("abc de");
  });

  it("solo toma los resultados definitivos nuevos", () => {
    const event = {
      resultIndex: 1,
      results: [
        Object.assign([{ transcript: "viejo" }], { isFinal: true }),
        Object.assign([{ transcript: "nuevo uno" }], { isFinal: true }),
        Object.assign([{ transcript: "a medias" }], { isFinal: false }),
        Object.assign([{ transcript: "nuevo dos" }], { isFinal: true }),
      ],
    };
    expect(finalTranscript(event)).toBe("nuevo uno nuevo dos");
    expect(finalTranscript({})).toBe("");
  });
});
