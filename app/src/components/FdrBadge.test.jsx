import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FdrBadge from "./FdrBadge";

const fdrMap = { ARS: 5, SOU: 1, MCI: 4 };

describe("FdrBadge", () => {
  it("renders the opponent name", () => {
    render(<FdrBadge opponent="ARS" fdrMap={fdrMap} />);
    expect(screen.getByText("ARS")).toBeInTheDocument();
  });

  it("renders the FDR number", () => {
    render(<FdrBadge opponent="ARS" fdrMap={fdrMap} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("defaults to FDR 3 for unknown teams", () => {
    render(<FdrBadge opponent="XYZ" fdrMap={fdrMap} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders correct FDR for easy fixture", () => {
    render(<FdrBadge opponent="SOU" fdrMap={fdrMap} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
