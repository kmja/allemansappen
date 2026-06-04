// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FirstRunExplainer } from "@/components/panels/FirstRunExplainer";

describe("FirstRunExplainer", () => {
  it("explains it gives no verdict and confirms on click", async () => {
    const onOpenChange = vi.fn();
    render(<FirstRunExplainer open onOpenChange={onOpenChange} />);

    expect(screen.getByText("Kan jag tälta här?")).toBeInTheDocument();
    expect(screen.getByText(/ger ingen dom/i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Jag förstår/i }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing when closed", () => {
    render(<FirstRunExplainer open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Kan jag tälta här?")).not.toBeInTheDocument();
  });
});
