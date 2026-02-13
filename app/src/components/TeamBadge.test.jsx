import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamBadge from "./TeamBadge";

describe("TeamBadge", () => {
  it("renders the team abbreviation", () => {
    render(<TeamBadge team="ARS" />);
    expect(screen.getByText("ARS")).toBeInTheDocument();
  });

  it("applies team color as background", () => {
    const { container } = render(<TeamBadge team="LIV" />);
    const badge = container.firstChild;
    expect(badge.style.backgroundColor).toBe("#C8102E");
  });

  it("uses fallback color for unknown teams", () => {
    const { container } = render(<TeamBadge team="XYZ" />);
    const badge = container.firstChild;
    expect(badge.style.backgroundColor).toBe("#484848");
  });

  it("uses light text for dark backgrounds", () => {
    // LIV is #C8102E - dark red, should get white text
    render(<TeamBadge team="LIV" />);
    const span = screen.getByText("LIV");
    expect(span.className).toContain("text-white");
  });

  it("uses dark text for light backgrounds", () => {
    // WOL is #FDB913 - bright gold, luminance > 0.55
    render(<TeamBadge team="WOL" />);
    const span = screen.getByText("WOL");
    expect(span.className).toContain("text-surface-50");
  });
});
