// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrinciplesPanel } from "@/components/panels/PrinciplesPanel";
import { PRINCIPLES } from "@/lib/allemansratten";

describe("PrinciplesPanel", () => {
  it("renders every principle and the honest 'not a verdict' note", () => {
    render(<PrinciplesPanel />);
    for (const p of PRINCIPLES) {
      expect(screen.getByText(p.title)).toBeInTheDocument();
    }
    expect(screen.getByText(/inte ett facit/i)).toBeInTheDocument();
  });

  it("links out to Naturvårdsverket rather than restating the law", () => {
    render(<PrinciplesPanel />);
    const link = screen.getByRole("link", {
      name: /Allemansrätten – Naturvårdsverket/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.naturvardsverket.se/allemansratten/",
    );
  });
});
