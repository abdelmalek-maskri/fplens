import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamBadge from "../../components/badges/TeamBadge";

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

  it.each([
    ["WOL", "#FDB913"],
    ["MCI", "#6CABDD"],
  ])("uses dark text on %s, whose colour is too bright for white", (team) => {
    render(<TeamBadge team={team} />);
    const span = screen.getByText(team);
    expect(span.className).toContain("text-surface-900");
    expect(span.className).not.toContain("text-white");
  });
});
