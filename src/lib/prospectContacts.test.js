import { describe, expect, it } from "vitest";
import { CONTACT_CHANNELS, FOLLOWUP_KEEP, FOLLOWUP_NONE, followupArg, validateContact } from "./prospectContacts";
import { addDaysISO, todayISO } from "./prospects";

describe("followupArg", () => {
  it("una fecha se manda tal cual", () => {
    expect(followupArg("2026-11-02")).toBe("2026-11-02");
  });

  it("'sin fecha' es null: borra el seguimiento", () => {
    expect(followupArg(FOLLOWUP_NONE)).toBeNull();
  });

  it("'dejar la fecha' o sin elegir es undefined: contactFields no toca una fecha futura", () => {
    expect(followupArg(FOLLOWUP_KEEP)).toBeUndefined();
    expect(followupArg("")).toBeUndefined();
  });
});

describe("validateContact", () => {
  it("exige un canal válido", () => {
    expect(validateContact({ channel: "" }).channel).toBe("prospects.contact.errors.channel");
    expect(validateContact({ channel: "paloma" }).channel).toBe("prospects.contact.errors.channel");
    for (const channel of CONTACT_CHANNELS) expect(validateContact({ channel })).toEqual({});
  });

  it("en etapa abierta pide elegir el seguimiento; en cerrada/perdida no", () => {
    expect(validateContact({ channel: "llamada", askFollowup: true }).followup).toBe("prospects.contact.errors.followup");
    expect(validateContact({ channel: "llamada", askFollowup: false })).toEqual({});
  });

  it("acepta una fecha, 'dejar la que tiene' o 'sin fecha' como elección", () => {
    for (const followup of [addDaysISO(3), FOLLOWUP_KEEP, FOLLOWUP_NONE, todayISO()]) {
      expect(validateContact({ channel: "llamada", followup, askFollowup: true })).toEqual({});
    }
  });

  it("rechaza una fecha de seguimiento en el pasado", () => {
    expect(validateContact({ channel: "llamada", followup: addDaysISO(-1), askFollowup: true }).followup).toBe("prospects.contact.errors.pastDate");
  });
});
