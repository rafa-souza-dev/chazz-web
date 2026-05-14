import type { Device } from "./types";

export type { Device };

export function normalizeDevices(payload: unknown): Device[] {
  if (!Array.isArray(payload)) return [];
  return (payload as unknown[])
    .filter((item): item is Device => {
      if (!item || typeof item !== "object") return false;
      const maybe = item as Partial<Device>;
      return (
        typeof maybe.id === "number" &&
        typeof maybe.external_id === "string" &&
        (typeof maybe.turn_off_at === "string" || maybe.turn_off_at === null) &&
        (typeof maybe.name === "string" || maybe.name === null || maybe.name === undefined) &&
        (typeof maybe.company_id === "number" || maybe.company_id === null || maybe.company_id === undefined)
      );
    })
    .map((d) => ({ ...d, name: d.name ?? null, company_id: d.company_id ?? null }))
    .sort((a, b) => a.id - b.id);
}

export function isDeviceOff(turnOffAt: string | null, nowMs: number): boolean {
  if (!turnOffAt) return true;
  const target = Date.parse(turnOffAt);
  if (Number.isNaN(target)) return true;
  return nowMs > target;
}

export function getRemainingMs(turnOffAt: string, nowMs: number): number {
  const target = Date.parse(turnOffAt);
  if (Number.isNaN(target)) return 0;
  return Math.max(target - nowMs, 0);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export type DeviceRescheduledEvent = {
  type: "device_rescheduled";
  device_id: number;
  turn_off_at: string;
};

export function isDeviceRescheduledEvent(value: unknown): value is DeviceRescheduledEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DeviceRescheduledEvent>;
  return (
    event.type === "device_rescheduled" &&
    typeof event.device_id === "number" &&
    typeof event.turn_off_at === "string"
  );
}
