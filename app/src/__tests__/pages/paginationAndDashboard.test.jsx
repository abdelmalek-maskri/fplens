import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../../pages/Dashboard";
import Accuracy from "../../pages/Accuracy";

const state = vi.hoisted(() => ({ fixtures: { data: null, error: null } }));

vi.mock("../../hooks", async (importOriginal) => {
  const actual = await importOriginal();
  const predictions = Array.from({ length: 51 }, (_, i) => ({
    element: i + 1,
    web_name: `Player ${i + 1}`,
    team_name: "ARS",
    position: "MID",
    status: "a",
    predicted_points: 51 - i,
    uncertainty: 1,
    form: 2,
    value: 5,
    selected_by_percent: 1,
    captain_pct: 0,
  }));
  const accuracy = {
    gameweek: 1,
    final: true,
    names: { model: "Model" },
    models: {
      model: {
        players: Array.from({ length: 51 }, (_, i) => ({
          element: i + 1,
          name: `Result ${i + 1}`,
          predicted: 1,
          actual: 2,
        })),
      },
    },
  };
  return {
    ...actual,
    usePredictions: () => ({ data: { predictions }, models: [], isLoading: false, error: null }),
    useFixtures: () => state.fixtures,
    useAccuracy: () => ({
      data: accuracy,
      isLoading: false,
      error: null,
    }),
    useGameweek: () => ({ data: null }),
  };
});

function renderPage(page, path = "/") {
  return render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>);
}

beforeEach(() => {
  state.fixtures = { data: null, error: null };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("paginated tables", () => {
  it.each([
    ["predictions", <Dashboard />, "Player predictions", "Player 51"],
    ["accuracy", <Accuracy />, "Every player, by model", "Result 51"],
  ])("moves to the %s heading after changing page", (_, page, headingName, lastPlayer) => {
    renderPage(page);
    const heading = screen.getByRole("heading", { name: headingName });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(lastPlayer)).toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(heading.scrollIntoView).toHaveBeenCalledOnce();
  });
});

describe("dashboard fixtures and empty state", () => {
  it("shows an unavailable message when expanded fixtures failed", () => {
    state.fixtures = { data: null, error: new Error("failed") };
    renderPage(<Dashboard />);
    expect(screen.queryByText("Fixtures are currently unavailable.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fixtures/ }));
    expect(screen.getByText("Fixtures are currently unavailable.")).toBeInTheDocument();
  });

  it("renders available fixtures when expanded", () => {
    state.fixtures = {
      error: null,
      data: {
        currentGw: 1,
        fixtures: { ARS: [{ gw: 1, home: true, opponent: "CHE", atkFdr: 2, defFdr: 3 }] },
      },
    };
    renderPage(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: /Fixtures/ }));
    expect(screen.getByText("CHE")).toBeInTheDocument();
    expect(screen.queryByText("Fixtures are currently unavailable.")).not.toBeInTheDocument();
  });

  it("prioritizes search guidance and retains flagged guidance without a search", () => {
    renderPage(<Dashboard />, "/?flagged=1&pos=DEF");
    expect(screen.getByText(/No flagged players in this position/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search players" }), {
      target: { value: "missing" },
    });
    expect(screen.getByText("Try a different search or adjust your filters.")).toBeInTheDocument();
    expect(screen.queryByText(/No flagged players in this position/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search players" }), {
      target: { value: "" },
    });
    expect(screen.getByText(/No flagged players in this position/)).toBeInTheDocument();
  });
});
