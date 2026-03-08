import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TabBar from "./TabBar";

const tabs = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

describe("TabBar", () => {
  it("renders all tab labels", () => {
    render(<TabBar tabs={tabs} active="a" onChange={() => {}} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("has role=tablist on the container", () => {
    render(<TabBar tabs={tabs} active="a" onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("has role=tab on each button", () => {
    render(<TabBar tabs={tabs} active="a" onChange={() => {}} />);
    const tabElements = screen.getAllByRole("tab");
    expect(tabElements).toHaveLength(3);
  });

  it("marks the active tab with aria-selected=true", () => {
    render(<TabBar tabs={tabs} active="b" onChange={() => {}} />);
    const tabB = screen.getByText("Beta").closest("[role='tab']");
    const tabA = screen.getByText("Alpha").closest("[role='tab']");
    expect(tabB).toHaveAttribute("aria-selected", "true");
    expect(tabA).toHaveAttribute("aria-selected", "false");
  });

  it("active tab has tabIndex=0, others have tabIndex=-1", () => {
    render(<TabBar tabs={tabs} active="a" onChange={() => {}} />);
    const tabA = screen.getByText("Alpha").closest("[role='tab']");
    const tabB = screen.getByText("Beta").closest("[role='tab']");
    expect(tabA).toHaveAttribute("tabindex", "0");
    expect(tabB).toHaveAttribute("tabindex", "-1");
  });

  it("calls onChange when a tab is clicked", () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="a" onChange={onChange} />);
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("navigates to next tab on ArrowRight", () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="a" onChange={onChange} />);
    const tabA = screen.getByText("Alpha").closest("[role='tab']");
    fireEvent.keyDown(tabA, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("navigates to previous tab on ArrowLeft", () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="b" onChange={onChange} />);
    const tabB = screen.getByText("Beta").closest("[role='tab']");
    fireEvent.keyDown(tabB, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("wraps to first tab on ArrowRight from last", () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="c" onChange={onChange} />);
    const tabC = screen.getByText("Gamma").closest("[role='tab']");
    fireEvent.keyDown(tabC, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("navigates to first tab on Home", () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="c" onChange={onChange} />);
    const tabC = screen.getByText("Gamma").closest("[role='tab']");
    fireEvent.keyDown(tabC, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("navigates to last tab on End", () => {
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="a" onChange={onChange} />);
    const tabA = screen.getByText("Alpha").closest("[role='tab']");
    fireEvent.keyDown(tabA, { key: "End" });
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
