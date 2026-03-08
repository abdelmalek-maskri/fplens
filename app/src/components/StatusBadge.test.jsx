import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders Available for status 'a'", () => {
    render(<StatusBadge status="a" />);
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("renders Injured for status 'i'", () => {
    render(<StatusBadge status="i" />);
    expect(screen.getByText("Injured")).toBeInTheDocument();
  });

  it("renders Doubtful with chance percentage", () => {
    render(<StatusBadge status="d" chance={75} />);
    expect(screen.getByText("Doubtful (75%)")).toBeInTheDocument();
  });

  it("renders compact labels", () => {
    render(<StatusBadge status="a" compact />);
    expect(screen.getByText("Fit")).toBeInTheDocument();
  });

  it("renders compact doubtful as percentage only", () => {
    render(<StatusBadge status="d" chance={50} compact />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders Suspended for status 's'", () => {
    render(<StatusBadge status="s" />);
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("falls back to Unavailable for unknown status", () => {
    render(<StatusBadge status="z" />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
