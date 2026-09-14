import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectGauge,
  getBluetoothAvailability,
  getConfiguredProfile,
  SUPPORTED_GAUGE_PROFILES,
  type GaugeProfile,
} from "./bluetooth";

// Fictitious test-only binary protocol; this is not a KTC/device profile.
const profile: GaugeProfile = {
  id: "fixture-only",
  label: "Fictitious gauge",
  serviceUUID: "b5295000-3922-4473-9643-92177e7c6591",
  characteristicUUID: "b5295001-3922-4473-9643-92177e7c6591",
  minFrameBytes: 3,
  maxFrameBytes: 3,
  minMm: 0,
  maxMm: 25,
  decode(frame) {
    if (frame.getUint8(0) !== 0xa5) throw new Error("Wrong status/unit header");
    return frame.getUint16(1, true) / 10;
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function radio() {
  const characteristic = Object.assign(new EventTarget(), {
    value: undefined as DataView | undefined,
    startNotifications: vi.fn(async () => characteristic),
    stopNotifications: vi.fn(async () => characteristic),
  });
  const service = { getCharacteristic: vi.fn(async () => characteristic) };
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      gatt.connected = true;
      return gatt;
    }),
    disconnect: vi.fn(() => {
      gatt.connected = false;
    }),
    getPrimaryService: vi.fn(async () => service),
  };
  const device = Object.assign(new EventTarget(), { name: "Test gauge", gatt });
  const requestDevice = vi.fn(async () => device);
  vi.stubGlobal("navigator", {
    bluetooth: { requestDevice },
    userActivation: { isActive: true },
  });
  const callbacks = {
    onReading: vi.fn(),
    onDisconnect: vi.fn(),
    onError: vi.fn(),
  };
  function notify(bytes: number[], offset = 0) {
    const buffer = new Uint8Array(offset + bytes.length + 2);
    buffer.set(bytes, offset);
    characteristic.value = new DataView(buffer.buffer, offset, bytes.length);
    characteristic.dispatchEvent(new Event("characteristicvaluechanged"));
  }
  return {
    characteristic,
    service,
    gatt,
    device,
    requestDevice,
    callbacks,
    notify,
  };
}

describe("reviewed Bluetooth gauge transport", () => {
  beforeEach(() => {
    vi.stubGlobal("isSecureContext", true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ships no guessed manufacturer's protocol and never opens a chooser without one", async () => {
    const r = radio();
    expect(SUPPORTED_GAUGE_PROFILES).toEqual([]);
    expect(getConfiguredProfile()).toBeUndefined();
    await expect(connectGauge(undefined, r.callbacks)).rejects.toMatchObject({
      code: "PROFILE_REQUIRED",
    });
    expect(r.requestDevice).not.toHaveBeenCalled();
  });

  it("distinguishes unsupported and insecure contexts from API availability", async () => {
    vi.stubGlobal("navigator", {});
    expect(getBluetoothAvailability()).toBe("unsupported");
    const r = radio();
    expect(getBluetoothAvailability()).toBe("available");
    vi.stubGlobal("isSecureContext", false);
    expect(getBluetoothAvailability()).toBe("insecure");
    await expect(connectGauge(profile, r.callbacks)).rejects.toMatchObject({
      code: "INSECURE",
    });
    expect(r.requestDevice).not.toHaveBeenCalled();
  });

  it("requires a gesture and validates all profile constraints before discovery", async () => {
    const r = radio();
    for (const change of [
      { serviceUUID: "battery_service" },
      { characteristicUUID: "unknown" },
      { minFrameBytes: 0 },
      { maxFrameBytes: 513 },
      { maxMm: NaN },
      { minMm: -1 },
      { maxMm: 0 },
    ]) {
      await expect(
        connectGauge({ ...profile, ...change }, r.callbacks),
      ).rejects.toMatchObject({ code: "INVALID_PROFILE" });
    }
    vi.stubGlobal("navigator", {
      bluetooth: { requestDevice: r.requestDevice },
      userActivation: { isActive: false },
    });
    await expect(connectGauge(profile, r.callbacks)).rejects.toMatchObject({
      code: "USER_GESTURE_REQUIRED",
    });
    expect(r.requestDevice).not.toHaveBeenCalled();
  });

  it("uses only the configured service, decodes exact byte slices and does not manufacture a reading", async () => {
    const r = radio();
    const result = connectGauge(profile, r.callbacks);
    // Called synchronously inside the click handler, before transient activation expires.
    expect(r.requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [profile.serviceUUID] }],
    });
    const connection = await result;
    expect(r.gatt.getPrimaryService).toHaveBeenCalledWith(profile.serviceUUID);
    expect(r.service.getCharacteristic).toHaveBeenCalledWith(
      profile.characteristicUUID,
    );
    expect(connection.deviceName).toBe("Test gauge");
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
    r.notify([0xa5, 84, 0], 4);
    expect(r.callbacks.onReading).toHaveBeenCalledWith(8.4, "Test gauge");
    r.notify([0xa5, 0, 0]);
    expect(r.callbacks.onReading).toHaveBeenLastCalledWith(0, "Test gauge");
    connection.disconnect();
  });

  it("rejects truncated, wrong-status, oversized, out-of-range and non-finite frames", async () => {
    const r = radio();
    const decode = vi.fn(profile.decode);
    const connection = await connectGauge({ ...profile, decode }, r.callbacks);
    r.notify([0xa5]);
    r.notify([0xa5, 20, 0, 0]);
    expect(decode).not.toHaveBeenCalled();
    r.notify([0xff, 20, 0]);
    r.notify([0xa5, 0xff, 0xff]);
    decode.mockReturnValueOnce(NaN);
    r.notify([0xa5, 10, 0]);
    expect(r.callbacks.onError).toHaveBeenCalledTimes(5);
    expect(r.callbacks.onError).toHaveBeenLastCalledWith("INVALID_FRAME");
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
    r.notify([0xa5, 105, 0]);
    expect(r.callbacks.onReading).toHaveBeenCalledWith(10.5, "Test gauge");
    connection.disconnect();
  });

  it("releases notifications/listeners once and ignores all readings after manual disconnect", async () => {
    const r = radio();
    const remove = vi.spyOn(r.characteristic, "removeEventListener");
    const removeDevice = vi.spyOn(r.device, "removeEventListener");
    const connection = await connectGauge(profile, r.callbacks);
    connection.disconnect();
    connection.disconnect();
    r.device.dispatchEvent(new Event("gattserverdisconnected"));
    r.notify([0xa5, 45, 0]);
    expect(remove).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      expect.any(Function),
    );
    expect(removeDevice).toHaveBeenCalledWith(
      "gattserverdisconnected",
      expect.any(Function),
    );
    expect(r.characteristic.stopNotifications).toHaveBeenCalledTimes(1);
    expect(r.gatt.disconnect).toHaveBeenCalledTimes(1);
    expect(r.callbacks.onDisconnect).toHaveBeenCalledTimes(1);
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
  });

  it("cleans up remote disconnects and never automatically reconnects", async () => {
    const r = radio();
    await connectGauge(profile, r.callbacks);
    r.gatt.connected = false;
    r.device.dispatchEvent(new Event("gattserverdisconnected"));
    r.notify([0xa5, 70, 0]);
    expect(r.callbacks.onDisconnect).toHaveBeenCalledTimes(1);
    expect(r.characteristic.stopNotifications).toHaveBeenCalledTimes(1);
    expect(r.gatt.connect).toHaveBeenCalledTimes(1);
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
  });

  it("maps cancelled chooser and permission denial without a spurious disconnect", async () => {
    const r = radio();
    r.requestDevice.mockRejectedValueOnce(
      new DOMException("cancel", "NotFoundError"),
    );
    await expect(connectGauge(profile, r.callbacks)).rejects.toMatchObject({
      code: "CANCELLED",
    });
    r.requestDevice.mockRejectedValueOnce(
      new DOMException("denied", "SecurityError"),
    );
    await expect(connectGauge(profile, r.callbacks)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    expect(r.callbacks.onDisconnect).not.toHaveBeenCalled();
    expect(r.callbacks.onError).not.toHaveBeenCalled();
  });

  it("aborts before selection without connecting to a device selected later", async () => {
    const r = radio();
    const selection = deferred<typeof r.device>();
    r.requestDevice.mockReturnValueOnce(selection.promise);
    const abort = new AbortController();
    const result = connectGauge(profile, r.callbacks, { signal: abort.signal });
    const rejected = expect(result).rejects.toMatchObject({
      code: "CANCELLED",
    });
    abort.abort();
    await rejected;
    selection.resolve(r.device);
    await Promise.resolve();
    expect(r.gatt.connect).not.toHaveBeenCalled();
    expect(r.gatt.disconnect).toHaveBeenCalledTimes(1);
    expect(r.callbacks.onDisconnect).not.toHaveBeenCalled();
  });

  it("disconnects an established session when its screen's signal is aborted", async () => {
    const r = radio();
    const abort = new AbortController();
    await connectGauge(profile, r.callbacks, { signal: abort.signal });
    abort.abort();
    r.notify([0xa5, 100, 0]);
    expect(r.callbacks.onDisconnect).toHaveBeenCalledTimes(1);
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
  });

  it("rejects a mid-setup disconnect and handles notifications that start after cleanup", async () => {
    const r = radio();
    const started = deferred<typeof r.characteristic>();
    r.characteristic.startNotifications.mockReturnValueOnce(started.promise);
    const result = connectGauge(profile, r.callbacks);
    const rejected = expect(result).rejects.toMatchObject({
      code: "DISCONNECTED",
    });
    await vi.waitFor(() =>
      expect(r.characteristic.startNotifications).toHaveBeenCalled(),
    );
    r.device.dispatchEvent(new Event("gattserverdisconnected"));
    await rejected;
    started.resolve(r.characteristic);
    await Promise.resolve();
    r.notify([0xa5, 30, 0]);
    expect(r.characteristic.stopNotifications).toHaveBeenCalledTimes(2);
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
    expect(r.callbacks.onDisconnect).not.toHaveBeenCalled();
  });

  it("times out stalled connections and releases a GATT server that connects late", async () => {
    vi.useFakeTimers();
    const r = radio();
    const pending = deferred<typeof r.gatt>();
    r.gatt.connect.mockReturnValueOnce(pending.promise);
    const result = connectGauge(profile, r.callbacks, { timeoutMs: 1000 });
    const rejected = expect(result).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    r.gatt.connected = true;
    pending.resolve(r.gatt);
    await Promise.resolve();
    expect(r.gatt.connected).toBe(false);
    expect(r.gatt.getPrimaryService).not.toHaveBeenCalled();
    expect(r.callbacks.onReading).not.toHaveBeenCalled();
  });
});
