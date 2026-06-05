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

  it("prompts to locate when there is no position yet", () => {
    render(
      <PositionAssessmentPanel
        assessment={{ located: false, positionInView: false, rules: [] }}
      />,
    );
    expect(screen.getByText(/Tryck på platsknappen/i)).toBeInTheDocument();
  });
});

describe("AssessmentSummary", () => {
  it("invites locating when there is no fix", () => {
    render(
      <AssessmentSummary
        assessment={{ located: false, positionInView: false, rules: [] }}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("Bedöm din plats")).toBeInTheDocument();
  });

  it("shows a loading state while overlays are still fetching", () => {
    const checking: PositionAssessment = {
      located: true,
      positionInView: true,
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
