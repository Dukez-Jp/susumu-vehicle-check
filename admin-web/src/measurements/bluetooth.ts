/** Reviewed, device-specific BLE protocols belong here, never in free-form UI. */
export interface GaugeProfile {
  readonly id: string;
  readonly label: string;
  readonly serviceUUID: string;
  readonly characteristicUUID: string;
  readonly minFrameBytes: number;
  readonly maxFrameBytes: number;
  readonly minMm: number;
  readonly maxMm: number;
  /** Must validate the device's framing, status, unit and byte order. */
  readonly decode: (frame: DataView) => number;
}

// No manufacturer's protocol or physical instrument has been validated yet.
export const SUPPORTED_GAUGE_PROFILES: readonly GaugeProfile[] = Object.freeze(
  [],
);
export function getConfiguredProfile(): GaugeProfile | undefined {
  return SUPPORTED_GAUGE_PROFILES[0];
}

export type GaugeBluetoothErrorCode =
  | "PROFILE_REQUIRED"
  | "INVALID_PROFILE"
  | "UNSUPPORTED"
  | "INSECURE"
  | "USER_GESTURE_REQUIRED"
  | "CANCELLED"
  | "PERMISSION_DENIED"
  | "TIMEOUT"
  | "DISCONNECTED"
  | "CONNECTION_FAILED"
  | "INVALID_FRAME";

export class GaugeBluetoothError extends Error {
  constructor(readonly code: GaugeBluetoothErrorCode) {
    super(code);
    this.name = "GaugeBluetoothError";
  }
}

export interface GaugeConnection {
  readonly deviceName: string;
  readonly profileId: string;
  disconnect(): void;
}

export interface GaugeCallbacks {
  onReading(valueMm: number, deviceName: string): void;
  onDisconnect(): void;
  /** Invalid notifications only; initial connection errors reject the promise. */
  onError(code: GaugeBluetoothErrorCode): void;
}

// Minimal structural types avoid adding a global, browser-specific DOM dependency.
interface GaugeCharacteristic extends EventTarget {
  readonly value?: DataView;
  startNotifications(): Promise<GaugeCharacteristic>;
  stopNotifications(): Promise<GaugeCharacteristic>;
}
interface GaugeService {
  getCharacteristic(uuid: string): Promise<GaugeCharacteristic>;
}
interface GaugeServer {
  readonly connected: boolean;
  connect(): Promise<GaugeServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<GaugeService>;
}
interface GaugeDevice extends EventTarget {
  readonly name?: string;
  readonly gatt?: GaugeServer;
}
interface BluetoothApi {
  requestDevice(options: {
    filters: { services: string[] }[];
  }): Promise<GaugeDevice>;
}

function browserBluetooth(): BluetoothApi | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth;
}

/** Reports API availability, not radio power, permission or device compatibility. */
export function getBluetoothAvailability():
  "available" | "unsupported" | "insecure" {
  if (typeof window !== "undefined" && window.isSecureContext === false)
    return "insecure";
  return typeof browserBluetooth()?.requestDevice === "function"
    ? "available"
    : "unsupported";
}

function validateProfile(profile: GaugeProfile): void {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !profile ||
    typeof profile.id !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(profile.id) ||
    typeof profile.label !== "string" ||
    !profile.label.trim() ||
    profile.label.length > 120 ||
    !uuid.test(profile.serviceUUID) ||
    !uuid.test(profile.characteristicUUID) ||
    !Number.isInteger(profile.minFrameBytes) ||
    !Number.isInteger(profile.maxFrameBytes) ||
    profile.minFrameBytes < 1 ||
    profile.maxFrameBytes < profile.minFrameBytes ||
    profile.maxFrameBytes > 512 ||
    !Number.isFinite(profile.minMm) ||
    !Number.isFinite(profile.maxMm) ||
    profile.minMm < 0 ||
    profile.maxMm <= profile.minMm ||
    profile.maxMm > 1000 ||
    typeof profile.decode !== "function"
  )
    throw new GaugeBluetoothError("INVALID_PROFILE");
}

function connectionError(error: unknown): GaugeBluetoothError {
  if (error instanceof GaugeBluetoothError) return error;
  const name =
    error !== null && typeof error === "object" && "name" in error
      ? error.name
      : "";
  if (name === "NotFoundError" || name === "AbortError")
    return new GaugeBluetoothError("CANCELLED");
  if (name === "NotAllowedError" || name === "SecurityError")
    return new GaugeBluetoothError("PERMISSION_DENIED");
  return new GaugeBluetoothError("CONNECTION_FAILED");
}

/**
 * Call directly from a click/tap handler. No scanning, reconnecting or initial
 * reads happen automatically. UI must review the value before saving it.
 * The optional AbortSignal also releases an established connection on unmount.
 */
export async function connectGauge(
  profile: GaugeProfile | undefined,
  callbacks: GaugeCallbacks,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<GaugeConnection> {
  if (!profile) throw new GaugeBluetoothError("PROFILE_REQUIRED");
  validateProfile(profile);
  const availability = getBluetoothAvailability();
  if (availability !== "available")
    throw new GaugeBluetoothError(
      availability === "insecure" ? "INSECURE" : "UNSUPPORTED",
    );
  if (navigator.userActivation?.isActive === false)
    throw new GaugeBluetoothError("USER_GESTURE_REQUIRED");
  if (options.signal?.aborted) throw new GaugeBluetoothError("CANCELLED");
  const timeoutMs = options.timeoutMs ?? 30000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
    throw new GaugeBluetoothError("INVALID_PROFILE");

  // Snapshot the protocol; a caller cannot change frame decoding mid-session.
  const protocol = { ...profile };
  let device: GaugeDevice | undefined;
  let characteristic: GaugeCharacteristic | undefined;
  let closed = false;
  let ready = false;
  let deviceName = protocol.label;
  let rejectInterrupted!: (error: GaugeBluetoothError) => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectInterrupted = reject;
  });

  function stopNotifications(target: GaugeCharacteristic | undefined) {
    if (!target) return;
    // Removal is synchronous even if the browser's GATT operation later fails.
    target.removeEventListener("characteristicvaluechanged", onReading);
    try {
      void target.stopNotifications().catch(() => undefined);
    } catch {
      // A disconnected device can invalidate GATT attributes synchronously.
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    device?.removeEventListener("gattserverdisconnected", onDisconnected);
    stopNotifications(characteristic);
    try {
      device?.gatt?.disconnect();
    } catch {
      // Cleanup remains complete when the browser already lost the device.
    }
    if (ready) callbacks.onDisconnect();
  }

  function interrupt(code: GaugeBluetoothErrorCode) {
    rejectInterrupted(new GaugeBluetoothError(code));
    close();
  }

  function onAbort() {
    interrupt("CANCELLED");
  }

  function onDisconnected() {
    interrupt("DISCONNECTED");
  }

  function onReading() {
    if (closed || !ready || !characteristic) return;
    const frame = characteristic.value;
    let valueMm: number;
    try {
      if (
        !(frame instanceof DataView) ||
        frame.byteLength < protocol.minFrameBytes ||
        frame.byteLength > protocol.maxFrameBytes
      )
        throw new Error("Invalid frame length");
      // Preserve byteOffset/byteLength and isolate the browser-owned buffer.
      const bytes = new Uint8Array(
        frame.buffer,
        frame.byteOffset,
        frame.byteLength,
      );
      valueMm = protocol.decode(new DataView(Uint8Array.from(bytes).buffer));
      if (
        !Number.isFinite(valueMm) ||
        valueMm < protocol.minMm ||
        valueMm > protocol.maxMm
      )
        throw new Error("Invalid measurement");
    } catch {
      callbacks.onError("INVALID_FRAME");
      return;
    }
    callbacks.onReading(valueMm, deviceName);
  }

  const timer = setTimeout(() => interrupt("TIMEOUT"), timeoutMs);
  options.signal?.addEventListener("abort", onAbort, { once: true });

  function assertOpen() {
    if (closed) throw new GaugeBluetoothError("CANCELLED");
  }

  async function establish(): Promise<GaugeConnection> {
    // This invocation is before the first await to retain transient activation.
    device = await browserBluetooth()!.requestDevice({
      filters: [{ services: [protocol.serviceUUID] }],
    });
    if (closed) {
      device.gatt?.disconnect();
      assertOpen();
    }
    if (!device.gatt) throw new GaugeBluetoothError("CONNECTION_FAILED");
    deviceName = device.name?.trim().slice(0, 120) || protocol.label;
    device.addEventListener("gattserverdisconnected", onDisconnected);
    const server = await device.gatt.connect();
    if (closed) {
      server.disconnect();
      assertOpen();
    }
    const service = await server.getPrimaryService(protocol.serviceUUID);
    assertOpen();
    characteristic = await service.getCharacteristic(
      protocol.characteristicUUID,
    );
    assertOpen();
    characteristic.addEventListener("characteristicvaluechanged", onReading);
    await characteristic.startNotifications();
    if (closed) {
      stopNotifications(characteristic);
      assertOpen();
    }
    if (!server.connected) throw new GaugeBluetoothError("DISCONNECTED");
    ready = true;
    clearTimeout(timer);
    return { deviceName, profileId: protocol.id, disconnect: close };
  }

  try {
    return await Promise.race([establish(), interrupted]);
  } catch (error) {
    close();
    throw connectionError(error);
  }
}
