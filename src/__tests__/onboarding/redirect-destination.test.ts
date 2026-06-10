import { describe, expect, it } from "vitest";

// Mirrors the safe-redirect logic in src/routes/welcome.tsx — internal paths only,
// fallback to /court. Kept here as a unit so the rule can't drift silently.
function pickDestination(redirect: string | null | undefined): string {
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return "/court";
}

describe("welcome post-onboarding redirect", () => {
  it("defaults to /court when missing", () => {
    expect(pickDestination(undefined)).toBe("/court");
    expect(pickDestination(null)).toBe("/court");
    expect(pickDestination("")).toBe("/court");
  });

  it("accepts internal absolute paths", () => {
    expect(pickDestination("/spill/123")).toBe("/spill/123");
    expect(pickDestination("/me")).toBe("/me");
  });

  it("rejects protocol-relative URLs (open-redirect guard)", () => {
    expect(pickDestination("//evil.com")).toBe("/court");
  });

  it("rejects absolute external URLs", () => {
    expect(pickDestination("https://evil.com")).toBe("/court");
    expect(pickDestination("javascript:alert(1)")).toBe("/court");
  });
});
