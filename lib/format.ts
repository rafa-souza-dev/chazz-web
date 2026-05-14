export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatSecondsHuman(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) {
    return remaining > 0 ? `${minutes}min ${remaining}s` : `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}h ${restMinutes}min` : `${hours}h`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export function deviceIsOn(turnOffAt: string | Date | null | undefined): boolean {
  if (!turnOffAt) return false;
  const date = typeof turnOffAt === "string" ? new Date(turnOffAt) : turnOffAt;
  return date.getTime() > Date.now();
}
