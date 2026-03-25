export type Device = {
  id: number;
  external_id: string;
  cents_per_cycle: number;
  seconds_per_cycle: number;
  turn_off_at: string | null;
};

export type DeviceRescheduledEvent = {
  type: "device_rescheduled";
  device_id: number;
  turn_off_at: string;
};

export function normalizeDevices(payload: unknown): Device[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((item): item is Device => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const maybeDevice = item as Partial<Device>;
      return (
        typeof maybeDevice.id === "number" &&
        typeof maybeDevice.external_id === "string" &&
        typeof maybeDevice.cents_per_cycle === "number" &&
        typeof maybeDevice.seconds_per_cycle === "number" &&
        (typeof maybeDevice.turn_off_at === "string" || maybeDevice.turn_off_at === null)
      );
    })
    .sort((a, b) => a.id - b.id);
}

export function isDeviceOff(turnOffAt: string | null, nowMs: number): boolean {
  if (!turnOffAt) {
    return true;
  }

  const targetMs = Date.parse(turnOffAt);
  if (Number.isNaN(targetMs)) {
    return true;
  }

  return nowMs > targetMs;
}

export function getRemainingMs(turnOffAt: string, nowMs: number): number {
  const targetMs = Date.parse(turnOffAt);
  if (Number.isNaN(targetMs)) {
    return 0;
  }

  return Math.max(targetMs - nowMs, 0);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function isDeviceRescheduledEvent(value: unknown): value is DeviceRescheduledEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<DeviceRescheduledEvent>;
  return (
    event.type === "device_rescheduled" &&
    typeof event.device_id === "number" &&
    typeof event.turn_off_at === "string"
  );
}
