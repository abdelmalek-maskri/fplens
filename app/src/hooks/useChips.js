import { CURRENT_GW, mockGameweeks, mockChipsAvailable, CHIP_META } from "../mocks/chips";

const _data = { currentGw: CURRENT_GW, gameweeks: mockGameweeks, chipsAvailable: mockChipsAvailable, chipMeta: CHIP_META };

export function useChips() {
  return { data: _data, isLoading: false, error: null };
}
