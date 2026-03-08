// TODO: Wire to getMultiGW(horizon) once FF-9 multi-GW predictions are built
import { mockMyTeam, mockTransferTargets, GW_LABELS } from "../mocks/transfers";

const _data = { myTeam: mockMyTeam, targets: mockTransferTargets, gwLabels: GW_LABELS };

export function useTransfers() {
  return { data: _data, isLoading: false, error: null };
}
