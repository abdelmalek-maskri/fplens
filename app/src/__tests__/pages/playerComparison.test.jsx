import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const player = (id, web_name, over) => ({
  id,
  element: id,
  web_name,
  name: `${web_name} Full`,
  team: "MCI",
  team_name: "MCI",
  position: "FWD",
  value: 10,
  status: "a",
  form: 5,
  total_points: 50,
  chance_of_playing: 100,
  news: "",
  opponent_name: "FUL",
  selected_by_percent: 20,
  goals: 5,
  xG: 5,
  assists: 1,
  xA: 1,
  bonus: 5,
  minutes: 900,
  predicted_points: 5,
  ...over,
});

vi.mock("../../hooks", async (importOriginal) => ({
  ...(await importOriginal()),
  usePlayerPool: () => ({
    data: {
      players: [
        player(1, "Alpha", { predicted_points: 6.1, value: 15.8, minutes: 889 }),
        player(2, "Beta", { predicted_points: 4.9, value: 7.1, minutes: 722 }),
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

import PlayerComparison from "../../pages/PlayerComparison";

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlayerComparison />
    </MemoryRouter>
  );

describe("PlayerComparison stat rows", () => {
  it("puts each player's value on their own side of the label", () => {
    // The table used to be capped at max-w-xl and left-aligned, so both
    // columns sat under the first player's card and a reader had to track
    // back across empty space on every row. Each value now sits under the
    // card it belongs to, with the label between them.
    renderPage();
    const label = screen.getByText("Minutes");
    const row = label.parentElement;
    const cells = [...row.children].map((c) => c.textContent);
    expect(cells).toEqual(["889", "Minutes", "722"]);
  });

  it("bolds the better side and mutes the other", () => {
    renderPage();
    const row = screen.getByText("Predicted points").parentElement;
    const [left, , right] = row.children;
    expect(left.className).toMatch(/text-brand-700/);
    expect(right.className).toMatch(/text-surface-500/);
  });

  it("treats a cheaper price as the better side, not a smaller number", () => {
    renderPage();
    const row = screen.getByText("Price").parentElement;
    const [left, , right] = row.children;
    expect(right.className).toMatch(/text-brand-700/);
    expect(left.className).toMatch(/text-surface-500/);
  });

  it("highlights neither side for a fact with no winner", () => {
    // Ownership is information, not an advantage either way.
    renderPage();
    const row = screen.getByText("Owned by").parentElement;
    for (const cell of [row.children[0], row.children[2]]) {
      expect(cell.className).toMatch(/text-surface-800/);
    }
  });
});
