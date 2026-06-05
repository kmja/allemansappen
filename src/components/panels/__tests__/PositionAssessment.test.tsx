// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AssessmentSummary,
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

describe("AssessmentSummary", () => {
  it("invites locating when there is no fix", () => {
    render(<AssessmentSummary assessment={empty()} onOpen={() => {}} />);
    expect(screen.getByText("Bedöm din plats")).toBeInTheDocument();
  });

  it("surfaces the nearest-building distance as an always-on readout", () => {
    render(<AssessmentSummary assessment={located} onOpen={() => {}} />);
    expect(screen.getByText("~45 m")).toBeInTheDocument();
  });

  it("shows a loading state while overlays are still fetching", () => {
    const checking: PositionAssessment = {
      ...located,
      rules: [{ ...located.rules[0], verdict: "checking", headline: "Kontrollerar…" }],
    };
    render(<AssessmentSummary assessment={checking} onOpen={() => {}} />);
    expect(screen.getByText(/Hämtar underlag/i)).toBeInTheDocument();
  });

  it("opens the detail sheet when tapped", async () => {
    const onOpen = vi.fn();
    render(<AssessmentSummary assessment={located} onOpen={onOpen} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Visa bedömning/i }),
    );
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
