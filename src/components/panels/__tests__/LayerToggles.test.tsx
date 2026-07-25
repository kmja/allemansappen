// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LayerToggles } from "@/components/panels/LayerToggles";
import { OVERLAYS } from "@/lib/map/layers";
import type { DataStatus, OverlayId, OverpassKind } from "@/lib/types";

const enabled: Record<OverlayId, boolean> = {
  buildings: true,
  hemfridszon: false,
  landuse: true,
  reserves: true,
  amenities: true,
  property: false,
};
const statuses: Record<OverpassKind, DataStatus> = {
  buildings: "ready",
  landuse: "ready",
  reserves: "ready",
  amenities: "ready",
};

describe("LayerToggles", () => {
  it("renders every overlay label", () => {
    render(
      <LayerToggles
        enabled={enabled}
        onToggle={() => {}}
        statuses={statuses}
        propertyConfigured={false}
      />,
    );
    for (const o of OVERLAYS) {
      expect(screen.getByText(o.label)).toBeInTheDocument();
    }
  });

  it("disables the property layer and explains why when unconfigured", () => {
    render(
      <LayerToggles
        enabled={enabled}
        onToggle={() => {}}
        statuses={statuses}
        propertyConfigured={false}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "Fastighetsgränser" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Kräver konfigurerad Lantmäteriet-åtkomst/i),
    ).toBeInTheDocument();
  });

  it("calls onToggle with the overlay id when a switch is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <LayerToggles
        enabled={enabled}
        onToggle={onToggle}
        statuses={statuses}
        propertyConfigured={false}
      />,
    );
    await userEvent.click(screen.getByRole("switch", { name: "Byggnader" }));
    expect(onToggle).toHaveBeenCalledWith("buildings");
  });
});
