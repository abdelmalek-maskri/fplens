import { mockUserTeam, mockTransferSuggestions } from "../mocks/team";

const _data = { team: mockUserTeam, transferSuggestions: mockTransferSuggestions };

export function useTeam() {
  return { data: _data, isLoading: false, error: null };
}
