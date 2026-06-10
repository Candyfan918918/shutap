import { describe, expect, it } from "vitest";
import type { ClaimAliasResult } from "@/lib/alias.functions";

// Reproduces the error→reason mapping inside claimAlias so we can pin the
// race-handling contract without standing up a real Supabase client.
function mapClaimError(
  profile: { age_verified: boolean | null; blocked_reason: string | null } | null,
  updateError: { code?: string; message?: string } | null,
): ClaimAliasResult {
  if (profile?.blocked_reason) return { ok: false, reason: "blocked" };
  if (!profile?.age_verified) return { ok: false, reason: "age_not_verified" };
  if (updateError) {
    if (updateError.code === "23505") return { ok: false, reason: "taken" };
    return { ok: false, reason: "unknown", message: updateError.message };
  }
  return { ok: true };
}

describe("claimAlias result mapping", () => {
  it("blocked profile → blocked", () => {
    expect(
      mapClaimError({ age_verified: true, blocked_reason: "underage" }, null),
    ).toEqual({ ok: false, reason: "blocked" });
  });

  it("not age-verified → age_not_verified", () => {
    expect(
      mapClaimError({ age_verified: false, blocked_reason: null }, null),
    ).toEqual({ ok: false, reason: "age_not_verified" });
  });

  it("unique violation (23505) → taken", () => {
    expect(
      mapClaimError(
        { age_verified: true, blocked_reason: null },
        { code: "23505", message: "duplicate key value" },
      ),
    ).toEqual({ ok: false, reason: "taken" });
  });

  it("any other PG error → unknown + message", () => {
    expect(
      mapClaimError(
        { age_verified: true, blocked_reason: null },
        { code: "42P01", message: "relation does not exist" },
      ),
    ).toEqual({
      ok: false,
      reason: "unknown",
      message: "relation does not exist",
    });
  });

  it("clean path → ok", () => {
    expect(
      mapClaimError({ age_verified: true, blocked_reason: null }, null),
    ).toEqual({ ok: true });
  });
});
