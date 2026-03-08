import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders the message when provided", () => {
    render(<EmptyState title="Empty" message="Try again later" />);
    expect(screen.getByText("Try again later")).toBeInTheDocument();
  });

  it("does not render message when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
  });
});

describe("ErrorState", () => {
  it("renders the default error message", () => {
    render(<ErrorState />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders a custom error message", () => {
    render(<ErrorState message="Failed to load data" />);
    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
  });

  it("renders retry button when onRetry provided", () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("does not render retry button without onRetry", () => {
    render(<ErrorState />);
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });
});
