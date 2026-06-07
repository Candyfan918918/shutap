import { describe, expect, it } from "vitest";
import { scrubPII } from "@/lib/safety/pii-scrubber";

describe("scrubPII", () => {
  it("returns empty result for empty input", () => {
    const r = scrubPII("");
    expect(r.text).toBe("");
    expect(r.piiRemoved).toBe(false);
    expect(r.removedKinds).toEqual([]);
  });

  it("leaves clean text alone", () => {
    const r = scrubPII("we had a fight about the dishes and it spiraled");
    expect(r.text).toBe("we had a fight about the dishes and it spiraled");
    expect(r.piiRemoved).toBe(false);
  });

  describe("emails", () => {
    it("scrubs a standard email", () => {
      const r = scrubPII("he texted me from jake.smith+work@example.co.uk last night");
      expect(r.text).toContain("[Email]");
      expect(r.text).not.toContain("jake.smith");
      expect(r.removedKinds).toContain("Email");
    });
  });

  describe("phones", () => {
    it("scrubs a US-format phone", () => {
      const r = scrubPII("call me at (415) 555-1234 if you want");
      expect(r.text).toContain("[Phone]");
      expect(r.removedKinds).toContain("Phone");
    });

    it("scrubs an international phone", () => {
      const r = scrubPII("his number is +44 20 7946 0958 fyi");
      expect(r.text).toContain("[Phone]");
      expect(r.removedKinds).toContain("Phone");
    });

    it("does not scrub a plain year", () => {
      const r = scrubPII("we met in 2019 and broke up in 2024");
      expect(r.text).not.toContain("[Phone]");
    });
  });

  describe("names with relationship context", () => {
    it("replaces 'my boyfriend Jake'", () => {
      const r = scrubPII("my boyfriend Jake said he didn't care");
      expect(r.text).toBe("my boyfriend [Name] said he didn't care");
      expect(r.removedKinds).toContain("Name");
    });

    it("replaces 'her sister Emma Lee'", () => {
      const r = scrubPII("her sister Emma Lee showed up uninvited");
      expect(r.text).toContain("her sister [Name]");
      expect(r.text).not.toContain("Emma Lee");
    });

    it("replaces 'called Sarah'", () => {
      const r = scrubPII("this woman called Sarah just walked in");
      expect(r.text).toContain("called [Name]");
    });
  });

  describe("addresses", () => {
    it("scrubs a US street address", () => {
      const r = scrubPII("he lives at 1234 Maple Street and won't move out");
      expect(r.text).toContain("[Address]");
      expect(r.text).not.toContain("Maple Street");
      expect(r.removedKinds).toContain("Address");
    });

    it("scrubs a US zip code", () => {
      const r = scrubPII("she moved back to 90210 last month");
      expect(r.text).toContain("[Address]");
    });

    it("scrubs a UK postcode", () => {
      const r = scrubPII("met him in SW1A 1AA which felt symbolic");
      expect(r.text).toContain("[Address]");
    });
  });

  it("scrubs an @handle", () => {
    const r = scrubPII("then @jake_smith92 unfollowed me");
    expect(r.text).toContain("[Handle]");
    expect(r.text).not.toContain("jake_smith92");
  });

  it("flags piiRemoved=true when anything matched and reports kinds", () => {
    const r = scrubPII("my boyfriend Jake texted me from jake@x.com at (415) 555-1234");
    expect(r.piiRemoved).toBe(true);
    expect(new Set(r.removedKinds)).toEqual(new Set(["Name", "Email", "Phone"]));
  });
});
