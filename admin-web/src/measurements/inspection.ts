import {
  emptyPreview,
  STORAGE_KEY,
  type PreviewState,
} from "../demo/pdf-preview/state";
import { normalizeVehicleKey, type MeasurementSession } from "./model";

type PreviewStorage = Pick<Storage, "getItem" | "setItem">;

/** Adapt only the PDF draft key; vehicle intake and historical stores stay separate. */
export function measurementPreviewStorage(
  storage: PreviewStorage,
  session: MeasurementSession,
): PreviewStorage {
  const scopedKey = `${STORAGE_KEY}:measurement:${session.id}`;
  const keyFor = (key: string) => (key === STORAGE_KEY ? scopedKey : key);
  return {
    getItem: (key) => storage.getItem(keyFor(key)),
    setItem: (key, value) => storage.setItem(keyFor(key), value),
  };
}

/** Start an inspection draft with identity only. Measurements never answer an item. */
export function seedMeasurementPreview(
  session: MeasurementSession,
): PreviewState {
  const state = emptyPreview();
  state.header.registration = session.registration;
  state.header.inspectionDate = session.inspectionDate;
  state.header.odometer = String(session.odometerKm);
  state.header.inspector = session.operator;
  return state;
}

/** Printing must be blocked if saved inspection identity differs from this session. */
export function measurementBindingValid(
  state: PreviewState,
  session: MeasurementSession,
): boolean {
  return (
    normalizeVehicleKey(state.header.registration) === session.vehicleKey &&
    state.header.inspectionDate === session.inspectionDate &&
    state.header.odometer === String(session.odometerKm) &&
    state.header.inspector === session.operator
  );
}
