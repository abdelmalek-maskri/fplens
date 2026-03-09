import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the API to return mock data
vi.mock("../lib/api", () => ({
  getNews: vi.fn(() =>
    import("../mocks/news").then((m) => ({
      articles: m.mockArticles,
      trending: [],
    })),
  ),
}));

import { useNews } from "./useNews";

describe("useNews", () => {
  it("starts in loading state", () => {
    const { result } = renderHook(() => useNews());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves with news data", async () => {
    const { result } = renderHook(() => useNews());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data).toHaveProperty("articles");
    expect(result.current.data).toHaveProperty("trending");
  });

  it("articles array is non-empty", async () => {
    const { result } = renderHook(() => useNews());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data.articles.length).toBeGreaterThan(0);
  });

  it("each article has required fields", async () => {
    const { result } = renderHook(() => useNews());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const article = result.current.data.articles[0];
    expect(article).toHaveProperty("headline");
    expect(article).toHaveProperty("date");
    expect(article).toHaveProperty("sentiment");
    expect(article).toHaveProperty("players");
    expect(article).toHaveProperty("injury_flag");
    expect(typeof article.sentiment).toBe("number");
    expect(typeof article.injury_flag).toBe("boolean");
    expect(Array.isArray(article.players)).toBe(true);
  });

});
