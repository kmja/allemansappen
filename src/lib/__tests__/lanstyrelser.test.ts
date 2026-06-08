import { describe, expect, it } from "vitest";
import {
  COUNTIES,
  countyByCode,
  countyByName,
  countyStartPage,
} from "@/lib/lanstyrelser";

describe("counties", () => {
  it("covers all 21 Swedish counties with unique codes", () => {
    expect(COUNTIES).toHaveLength(21);
    const codes = new Set(COUNTIES.map((c) => c.code));
    expect(codes.size).toBe(21);
  });

  it("looks up counties by code", () => {
    expect(countyByCode("M")?.name).toBe("Skåne");
    expect(countyByCode("BD")?.name).toBe("Norrbotten");
    expect(countyByCode("zz")).toBeUndefined();
    expect(countyByCode(null)).toBeUndefined();
  });

  it("builds the stable county start-page URL", () => {
    expect(countyStartPage("skane")).toBe(
      "https://www.lansstyrelsen.se/skane.html",
    );
  });

  it("matches counties by admin name (with/without 'län' and genitive -s)", () => {
    expect(countyByName("Stockholms län")?.code).toBe("AB");
    expect(countyByName("Skåne län")?.code).toBe("M");
    expect(countyByName("Västra Götalands län")?.code).toBe("O");
    expect(countyByName("Jämtlands län")?.code).toBe("Z");
    expect(countyByName("Dalarnas län")?.code).toBe("W");
    expect(countyByName("Kalmar län")?.code).toBe("H");
    expect(countyByName("Uppsala")?.code).toBe("C");
    expect(countyByName("nonsense")).toBeUndefined();
    expect(countyByName(null)).toBeUndefined();
  });
});
