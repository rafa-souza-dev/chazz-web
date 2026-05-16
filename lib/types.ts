export type Company = {
  id: number;
  name: string;
  night_rate: number | null;
  night_start: number | null;
  night_end: number | null;
};

export type Device = {
  id: number;
  external_id: string;
  name: string | null;
  turn_off_at: string | null;
  company_id: number | null;
};

export type DeviceCycle = {
  id: number;
  device_id: number;
  cents: number;
  seconds: number;
};

export type Coupon = {
  id: number;
  code: string;
  device_id: number;
  company_id: number;
  valid_until: string;
  release_seconds: number;
  used: boolean;
  used_at: string | null;
  created_by_user_id: number | null;
  created_at: string;
};

export type Role = {
  id: number;
  name: string;
  slug: string;
};

export type Transaction = {
  id: number;
  correlation_id: string;
  company_id: number | null;
  company_name: string | null;
  device_id: number;
  cycle_id: number;
  value_cents: number;
  paid_at: string;
};

export type AdminUser = {
  id: number;
  email: string;
  company_id: number | null;
  roles: string[];
  created_at: string;
  updated_at: string;
};

export type DeviceRescheduledEvent = {
  type: "device_rescheduled";
  device_id: number;
  turn_off_at: string;
};

export type DeviceTurnedOffEvent = {
  type: "device_turned_off";
  device_id: number;
  turn_off_at: null;
};

export type DeviceUpdateEvent = DeviceRescheduledEvent | DeviceTurnedOffEvent;

export function isDeviceUpdateEvent(value: unknown): value is DeviceUpdateEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.type !== "device_rescheduled" && obj.type !== "device_turned_off") return false;
  return typeof obj.device_id === "number";
}

export type ChargePayload = {
  brCode: string;
  expiresAt: string;
  correlationId: string;
};

export type ChargePaidEvent = {
  type: "charge_paid";
  cycle_id: number;
  device_id: number;
};

export function isChargePaidEvent(value: unknown): value is ChargePaidEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.type === "charge_paid" &&
    typeof obj.cycle_id === "number" &&
    typeof obj.device_id === "number"
  );
}
