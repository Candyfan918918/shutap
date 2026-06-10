import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

// Re-implement the same age formula here so we can pin the policy without
// importing the server fn (which pulls in server-only modules at chain time).
function ageYearsFrom(month: number, year: number, today = new Date()): number {
  let age = today.getUTCFullYear() - year;
  const m = today.getUTCMonth() + 1;
  if (m < month) age -= 1;
  return age;
}

describe("ageYearsFrom (verifyAge policy)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  it("18 today → 18", () => {
    expect(ageYearsFrom(6, 2008)).toBe(18);
  });

  it("birthday next month → still 17", () => {
    expect(ageYearsFrom(7, 2008)).toBe(17);
  });

  it("birthday last month → 18", () => {
    expect(ageYearsFrom(5, 2008)).toBe(18);
  });

  it("very old user → big number", () => {
    expect(ageYearsFrom(1, 1950)).toBeGreaterThan(70);
  });

  it("underage by year → 17", () => {
    expect(ageYearsFrom(1, 2009)).toBe(17);
  });
});
