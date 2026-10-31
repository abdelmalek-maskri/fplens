import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../../pages/Dashboard";

// 3 flagged goalkeepers, 1 flagged midfielder, 2 available midfielders.
const squad = vi.hoisted(() => [
  { position: "GK", status: "i", web_name: "Keeper A" },
  { position: "GK", status: "d", web_name: "Keeper B" },
  { position: "GK", status: "i", web_name: "Keeper C" },
  { position: "GK", status: "a", web_name: "Keeper D" },
  { position: "MID", status: "i", web_name: "Mid A" },
  { position: "MID", status: "a", web_name: "Mid B" },
  { position: "MID", status: "a", web_name: "Mid C" },
]);

vi.mock("../../hooks", async (importOriginal) => {
  const actual = await importOriginal();
  const predictions = squad.map((p, i) => ({
    element: i + 1,
    team_name: "ARS",
    predicted_points: squad.length - i,
    uncertainty: 1,
    form: 2,
    value: 5,
    selected_by_percent: 1,
    captain_pct: 0,
    ...p,
  }));
  return {
    ...actual,
    usePredictions: () => ({ data: { predictions }, models: [], isLoading: false, error: null }),
    useFixtures: () => ({ data: null, error: null }),
    useGameweek: () => ({ data: null }),
  };
});

const renderAt = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Dashboard />
    </MemoryRouter>
  );

const flaggedChip = () => screen.getByRole("button", { name: /flagged/ });

describe("flagged count", () => {
  it("counts every flagged player with no position filter", () => {
    renderAt();
    expect(flaggedChip()).toHaveTextContent("4 flagged");
  });

  it("follows the position filter", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "GK" }));
    expect(flaggedChip()).toHaveTextContent("3 flagged");
  });

  it("follows the search box", () => {
    renderAt();
    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: "Keeper A" } });
    expect(flaggedChip()).toHaveTextContent("1 flagged");
  });

  // Otherwise the chip would report its own result and the number would drop
  // the moment you pressed it, leaving no way back to the full count.
  it("does not narrow itself when the flagged filter is on", () => {
    renderAt("/?pos=GK&flagged=1");
    expect(flaggedChip()).toHaveTextContent("3 flagged");
    expect(flaggedChip()).toHaveAttribute("aria-pressed", "true");
    // The unflagged keeper is gone from the predictions table, though the tabs
    // below it still list him, so this looks only at that first table.
    const table = screen.getAllByRole("table")[0];
    expect(within(table).queryByText("Keeper D")).not.toBeInTheDocument();
    expect(within(table).getByText("Keeper A")).toBeInTheDocument();
  });
});
