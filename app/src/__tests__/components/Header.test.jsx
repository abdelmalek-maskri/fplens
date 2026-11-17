import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import Header from "../../components/layout/Header";

const originalTitle = document.title;

afterEach(() => {
  cleanup();
  document.title = originalTitle;
});

it("updates the tab title when navigating with the header mounted", () => {
  render(
    <MemoryRouter initialEntries={["/accuracy"]}>
      <Header />
      <Link to="/insights">Insights</Link>
      <Link to="/">Dashboard</Link>
      <Link to="/player/42">Player</Link>
      <Link to="/missing">Missing</Link>
    </MemoryRouter>
  );

  expect(document.title).toBe("Accuracy · FPLens");
  expect(screen.getByRole("heading")).toHaveTextContent("Accuracy");
  fireEvent.click(screen.getByRole("link", { name: "Insights" }));
  expect(document.title).toBe("Model Insights · FPLens");
  fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  expect(document.title).toBe("FPLens");
  expect(screen.getByRole("heading")).toHaveTextContent("Dashboard");
  fireEvent.click(screen.getByRole("link", { name: "Player" }));
  expect(document.title).toBe("FPLens");
  fireEvent.click(screen.getByRole("link", { name: "Missing" }));
  expect(document.title).toBe("FPLens");
});
