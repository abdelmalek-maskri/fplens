import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Layout from "../../components/layout/Layout";

vi.mock("../../hooks/useGameweek", () => ({ useGameweek: () => ({ data: null }) }));

// happy-dom has matchMedia but no way to move the viewport, so the listener is
// driven directly. `matches` starts false, i.e. a phone-width screen.
let listeners = [];
let desktop = false;

beforeEach(() => {
  listeners = [];
  desktop = false;
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return desktop;
    },
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener: (_, fn) => {
      listeners = listeners.filter((l) => l !== fn);
    },
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderLayout = () =>
  render(
    <MemoryRouter>
      <Layout>
        <p>page</p>
      </Layout>
    </MemoryRouter>
  );

const menuButton = () => screen.getByRole("button", { name: "Toggle menu" });
const crossToDesktop = () =>
  act(() => {
    desktop = true;
    listeners.forEach((fn) => fn({ matches: true }));
  });

describe("mobile drawer", () => {
  it("marks itself a dialog only while open", () => {
    renderLayout();
    const drawer = screen.getByLabelText("Site navigation");
    expect(drawer).not.toHaveAttribute("aria-modal");

    fireEvent.click(menuButton());
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).toHaveAttribute("role", "dialog");
  });

  // Safari does not focus a button when it is clicked, so capturing
  // document.activeElement on open would store <body> and lose focus here.
  it("returns focus to the menu button on close", () => {
    renderLayout();
    fireEvent.click(menuButton());
    expect(menuButton()).not.toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton()).toHaveFocus();
  });

  it("does not steal focus before it has ever opened", () => {
    renderLayout();
    expect(menuButton()).not.toHaveFocus();
  });

  // The backdrop and close button are lg:hidden, so leaving the drawer "open"
  // past that breakpoint keeps aria-modal over a sidebar that is just part of
  // the page, walling a screen reader off from content it can see.
  it("stops being a dialog when the viewport reaches desktop", () => {
    renderLayout();
    fireEvent.click(menuButton());
    expect(screen.getByLabelText("Site navigation")).toHaveAttribute("aria-modal", "true");

    crossToDesktop();
    const drawer = screen.getByLabelText("Site navigation");
    expect(drawer).not.toHaveAttribute("aria-modal");
    expect(drawer).not.toHaveAttribute("role");
  });
});
