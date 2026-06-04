import { describe, expect, it } from "vitest";
import { getFireBan } from "@/lib/server/fireban";

describe("getFireBan", () => {
  it("never asserts a ban — status is always unknown in v1", () => {
    expect(getFireBan("AB").status).toBe("unknown");
    expect(getFireBan(null).status).toBe("unknown");
  });

  it("includes the county's länsstyrelse link first when a county is given", () => {
    const r = getFireBan("AB");
    expect(r.county).toBe("Stockholm");
    expect(r.headline).toContain("Stockholm");
    expect(r.links[0].label).toContain("Länsstyrelsen Stockholm");
    expect(r.links[0].href).toContain("lansstyrelsen.se");
    // national links still appended
    expect(r.links.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to national links only without a (valid) county", () => {
    const r = getFireBan(null);
    expect(r.county).toBeUndefined();
    expect(r.headline).toBe("Kontrollera eldningsförbud lokalt");
    expect(r.links).toHaveLength(2);

    const invalid = getFireBan("ZZ");
    expect(invalid.county).toBeUndefined();
  });

  it("timestamps the result with a parseable ISO string", () => {
    const r = getFireBan("M");
    expect(Number.isNaN(Date.parse(r.checkedAt))).toBe(false);
    expect(r.source).toBeTruthy();
  });
});
