import { describe, expect, it } from "vitest";
import {
  COUNTIES,
  countyByCode,
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
});
