import { describe, expect, it } from "vitest";

// Mirrors the (ageVerified, aliasClaimed) branch in /welcome on mount.
type Phase = "dob" | "spin" | "redirect";

function resolvePhase(ident: {
  ageVerified: boolean;
  nationality: string | null;
  emotion: string | null;
  creature: string | null;
}): Phase {
  const aliasClaimed = Boolean(ident.nationality && ident.emotion && ident.creature);
  if (ident.ageVerified && aliasClaimed) return "redirect";
  if (ident.ageVerified) return "spin";
  return "dob";
}

describe("welcome phase resolver", () => {
  it("new OAuth user → dob", () => {
    expect(
      resolvePhase({ ageVerified: false, nationality: null, emotion: null, creature: null }),
    ).toBe("dob");
  });

  it("age-verified, no alias → spin", () => {
    expect(
      resolvePhase({ ageVerified: true, nationality: null, emotion: null, creature: null }),
    ).toBe("spin");
  });

  it("age-verified, partial alias → still spin", () => {
    expect(
      resolvePhase({ ageVerified: true, nationality: "Italian", emotion: null, creature: null }),
    ).toBe("spin");
  });

  it("fully onboarded → redirect", () => {
    expect(
      resolvePhase({
        ageVerified: true,
        nationality: "Italian",
        emotion: "Wistful",
        creature: "Koi",
      }),
    ).toBe("redirect");
  });

  it("alias set but not age-verified (legacy data) → dob", () => {
    // Defense: even if old data has alias fields, age gate still wins.
    expect(
      resolvePhase({
        ageVerified: false,
        nationality: "Italian",
        emotion: "Wistful",
        creature: "Koi",
      }),
    ).toBe("dob");
  });
});
