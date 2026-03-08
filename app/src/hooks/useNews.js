// TODO: Wire to getNews() once FF-20 Guardian pipeline endpoint is built
import { mockArticles } from "../mocks/news";

const _data = { articles: mockArticles };

export function useNews() {
  return { data: _data, isLoading: false, error: null };
}
