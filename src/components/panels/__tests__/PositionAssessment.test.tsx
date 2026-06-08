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
    render(<PositionAssessmentPanel assessment={located} county={null} />);
    expect(screen.getByText(/ger ingen dom/i)).toBeInTheDocument();
    expect(screen.getByText(/grönt betyder bara/i)).toBeInTheDocument();
  });

  it("lists every land rule with its status headline", () => {
    render(<PositionAssessmentPanel assessment={located} county={null} />);
    for (const label of ["Naturreservat", "Brukad mark", "Hemfridszon"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("~45 m till byggnad")).toBeInTheDocument();
  });

  it("shows the fire ban only as a footnote that doesn't affect the verdict", () => {
    render(<PositionAssessmentPanel assessment={located} county="M" />);
    expect(
      screen.getByText(/påverkar inte bedömningen ovan/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Länsstyrelsen Skåne/i }),
    ).toBeInTheDocument();
  });

  it("prompts to locate or tap when there is no position yet", () => {
    render(<PositionAssessmentPanel assessment={empty()} county={null} />);
    expect(screen.getByText(/Tryck på platsknappen/i)).toBeInTheDocument();
  });

  it("labels a tapped point and offers a way back to GPS", async () => {
    const onUseMyLocation = vi.fn();
    render(
      <PositionAssessmentPanel
        assessment={{ ...located, origin: "picked" }}
        county={null}
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
    render(
      <AssessmentCard
        assessment={empty()}
        county={null}
        onOpenDetails={() => {}}
      />,
    );
    expect(screen.getByText(/Tryck på platsknappen/i)).toBeInTheDocument();
  });

  it("shows a prominent verdict and every land rule without opening anything", () => {
    render(
      <AssessmentCard
        assessment={located}
        county={null}
        onOpenDetails={() => {}}
      />,
    );
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
    render(
      <AssessmentCard
        assessment={clearish}
        county={null}
        onOpenDetails={() => {}}
      />,
    );
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
    render(
      <AssessmentCard
        assessment={checking}
        county={null}
        onOpenDetails={() => {}}
      />,
    );
    expect(screen.getByText(/Kontrollerar din plats/i)).toBeInTheDocument();
  });

  it("opens the detail sheet via the Detaljer button", async () => {
    const onOpenDetails = vi.fn();
    render(
      <AssessmentCard
        assessment={located}
        county={null}
        onOpenDetails={onOpenDetails}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Detaljer" }));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });
});
