import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PlayerLink from "../../components/ui/PlayerLink";

const renderLink = (props = {}) =>
  render(
    <MemoryRouter>
      <PlayerLink element={42} {...props}>
        Palmer
      </PlayerLink>
    </MemoryRouter>
  );

describe("PlayerLink", () => {
  it("is a link, so a keyboard can reach it", () => {
    renderLink();
    expect(screen.getByRole("link", { name: "Palmer" })).toBeInTheDocument();
  });

  it("points at the player's page", () => {
    renderLink();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/player/42");
  });

  it("keeps the caller's classes alongside its own hover", () => {
    renderLink({ className: "font-medium" });
    const link = screen.getByRole("link");
    expect(link).toHaveClass("font-medium");
    expect(link).toHaveClass("hover:text-brand-700");
  });
});
