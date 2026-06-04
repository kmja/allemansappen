// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FireBanBanner } from "@/components/panels/FireBanBanner";
import type { FireBanResult } from "@/lib/types";

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

const sample: FireBanResult = {
  status: "unknown",
  headline: "Kontrollera eldningsförbud i Stockholm",
  detail: "Appen kan inte automatiskt bekräfta om det råder eldningsförbud här.",
  county: "Stockholm",
  links: [
    {
      label: "Länsstyrelsen Stockholm",
      href: "https://www.lansstyrelsen.se/stockholm.html",
    },
  ],
  checkedAt: new Date().toISOString(),
  source: "Länsstyrelsen / MSB",
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FireBanBanner", () => {
  it("shows the headline and never asserts that there is no ban", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(sample)));
    render(<FireBanBanner county="AB" onChangeCounty={() => {}} />);

    expect(
      await screen.findByText(/Kontrollera eldningsförbud i Stockholm/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/inget eldningsförbud/i),
    ).not.toBeInTheDocument();
  });

  it("expands to reveal the county selector and official link-out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(sample)));
    render(<FireBanBanner county="AB" onChangeCounty={() => {}} />);
    await screen.findByText(/Kontrollera eldningsförbud i Stockholm/);

    await userEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("Ditt län")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Länsstyrelsen Stockholm/ }),
    ).toHaveAttribute("href", "https://www.lansstyrelsen.se/stockholm.html");
  });

  it("falls back to an honest default when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<FireBanBanner county={null} onChangeCounty={() => {}} />);
    expect(
      await screen.findByText("Kontrollera eldningsförbud lokalt"),
    ).toBeInTheDocument();
  });
});
