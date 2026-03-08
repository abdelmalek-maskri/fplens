import { mockArticles } from "../mocks/news";

const _data = { articles: mockArticles };

export function useNews() {
  return { data: _data, isLoading: false, error: null };
}
