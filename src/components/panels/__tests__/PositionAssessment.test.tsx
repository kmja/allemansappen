// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AssessmentCard,
  PositionAssessmentPanel,
} from "@/components/panels/PositionAssessment";
import type { PositionAssessment } from "@/lib/types";

const located: PositionAssessment = {
  located: true,
  origin: "gps",
  positionInView: true,
  rules: [
    {
      id: "reserve",
      label: "Naturreservat",
      verdict: "clear",
      headline: "Inget reservat här",
      detail: "Du verkar inte vara i ett naturreservat (enligt OpenStreetMap-data).",
    },
    {
      id: "cultivated",
      label: "Brukad mark",
      verdict: "avoid",
      headline: "På brukad mark",
      detail: "Du står på åker, äng eller plantering – tälta inte här.",
    },
    {
      id: "hemfridszon",
      label: "Hemfridszon",
      verdict: "judgment",
      headline: "~45 m till byggnad",
      detail: "Kan ligga inom hemfridszonen.",
    },
    {
      id: "fire",
      label: "Eldningsförbud",
      verdict: "judgment",
      headline: "Kontrollera lokalt",
      detail: "Appen kan inte bekräfta om det råder eldningsförbud här.",
    },
  ],
};

const empty = (): PositionAssessment => ({
  located: false,
  origin: "gps",
  positionInView: false,
  rules: [],
});

describe("PositionAssessmentPanel", () => {
  it("frames green honestly and never as a verdict", () => {
    render(<PositionAssessmentPanel assessment={located} />);
    expect(screen.getByText(/ger ingen dom/i)).toBeInTheDocument();
    expect(screen.getByText(/grönt betyder bara/i)).toBeInTheDocument();
  });

  it("lists every rule with its status headline", () => {
    render(<PositionAssessmentPanel assessment={located} />);
    for (const label of [
      "Naturreservat",
      "Brukad mark",
      "Hemfridszon",
      "Eldningsförbud",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("~45 m till byggnad")).toBeInTheDocument();
    expect(screen.getByText("På brukad mark")).toBeInTheDocument();
  });

  it("prompts to locate or tap when there is no position yet", () => {
    render(<PositionAssessmentPanel assessment={empty()} />);
    expect(screen.getByText(/Tryck på platsknappen/i)).toBeInTheDocument();
  });

  it("labels a tapped point and offers a way back to GPS", async () => {
    const onUseMyLocation = vi.fn();
    render(
      <PositionAssessmentPanel
        assessment={{ ...located, origin: "picked" }}
        onUseMyLocation={onUseMyLocation}
      />,
    );
    expect(screen.getByText("Vald punkt på kartan")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Använd min plats" }),
    );
    expect(onUseMyLocation).toHaveBeenCalledOnce();
  });
});

describe("AssessmentCard", () => {
  it("invites locating when there is no fix", () => {
    render(<AssessmentCard assessment={empty()} onOpenDetails={() => {}} />);
    expect(screen.getByText(/Tryck på platsknappen/i)).toBeInTheDocument();
  });

  it("shows a prominent verdict and every rule status without opening anything", () => {
    render(<AssessmentCard assessment={located} onOpenDetails={() => {}} />);
    // An "avoid" rule is present -> the at-a-glance verdict warns.
    expect(screen.getByText("Något att undvika här")).toBeInTheDocument();
    expect(screen.getByText("Naturreservat")).toBeInTheDocument();
    expect(screen.getByText("~45 m till byggnad")).toBeInTheDocument();
  });

  it("reads as your-judgment when nothing must be avoided", () => {
    const clearish: PositionAssessment = {
      ...located,
      rules: located.rules.map((r) =>
        r.verdict === "avoid"
          ? { ...r, verdict: "clear", headline: "Inte brukad mark" }
          : r,
      ),
    };
    render(<AssessmentCard assessment={clearish} onOpenDetails={() => {}} />);
    expect(screen.getByText(/Inga tydliga hinder/i)).toBeInTheDocument();
  });

  it("shows a loading state while overlays are still fetching", () => {
    const checking: PositionAssessment = {
      ...located,
      rules: located.rules.map((r) => ({
        ...r,
        verdict: "checking",
        headline: "Kontrollerar…",
      })),
    };
    render(<AssessmentCard assessment={checking} onOpenDetails={() => {}} />);
    expect(screen.getByText(/Kontrollerar din plats/i)).toBeInTheDocument();
  });

  it("opens the detail sheet via the Detaljer button", async () => {
    const onOpenDetails = vi.fn();
    render(
      <AssessmentCard assessment={located} onOpenDetails={onOpenDetails} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Detaljer" }));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });
});
