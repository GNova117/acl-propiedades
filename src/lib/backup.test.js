import { describe, expect, it } from "vitest";
import { isBackupStale, lastBackupAt } from "./backup";

describe("lastBackupAt / isBackupStale sin almacenamiento disponible", () => {
  it("no revientan y se quedan del lado seguro (se asume que el respaldo está vencido)", () => {
    expect(lastBackupAt()).toBeNull();
    expect(isBackupStale()).toBe(true);
  });
});
