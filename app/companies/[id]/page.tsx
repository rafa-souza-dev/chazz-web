"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Power, Zap } from "lucide-react";
import { apiPublic, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isDeviceUpdateEvent, type Company, type Device } from "@/lib/types";
import { formatDuration, getRemainingMs, isDeviceOff } from "@/lib/devices";

function deriveWsUrl(apiBaseUrl: string): string {
  try {
    const url = new URL(apiBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    return url.toString();
  } catch {
    return "ws://localhost:3000/ws";
  }
}

const WS_URL = deriveWsUrl(API_BASE_URL);

export default function CompanyDevicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const companyId = Number(id);

  const [company, setCompany] = useState<Company | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(companyId)) {
      setError("ID de empresa inválido");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      apiPublic.get<Company>(`/companies/${companyId}`, { signal: controller.signal }),
      apiPublic.get<Device[]>(`/companies/${companyId}/devices`, { signal: controller.signal }),
    ])
      .then(([companyRes, devicesRes]) => {
        setCompany(companyRes.data);
        setDevices(devicesRes.data);
      })
      .catch((err) => {
        if (err.code !== "ERR_CANCELED") {
          setError(err.response?.data?.error ?? err.message ?? "Erro ao carregar dados");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [companyId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as unknown;
        if (!isDeviceUpdateEvent(data)) return;
        setDevices((current) =>
          current.map((d) =>
            d.id === data.device_id
              ? { ...d, turn_off_at: data.type === "device_rescheduled" ? data.turn_off_at : null }
              : d,
          ),
        );
      } catch {
        // ignore malformed
      }
    };
    return () => ws.close();
  }, []);

  const sortedDevices = useMemo(
    () => [...devices].sort((a, b) => a.id - b.id),
    [devices],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-8">
      <div className="space-y-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ChevronLeft className="size-4" /> Empresas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {loading ? "Carregando..." : company?.name ?? "Empresa"}
        </h1>
        {company ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            {sortedDevices.length}{" "}
            {sortedDevices.length === 1 ? "máquina" : "máquinas"}
          </p>
        ) : null}
      </div>

      {error ? (
        <Card className="border-red-300/60 bg-red-50/60 dark:bg-red-950/30">
          <CardContent className="py-6 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      {!error && !loading && sortedDevices.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Esta empresa ainda não tem máquinas cadastradas.
          </CardContent>
        </Card>
      ) : null}

      <ul className="flex flex-col gap-3">
        {sortedDevices.map((device) => {
          const off = isDeviceOff(device.turn_off_at, nowMs);
          const remaining = !off && device.turn_off_at ? getRemainingMs(device.turn_off_at, nowMs) : 0;
          return (
            <li key={device.id}>
              <Link
                href={`/devices/${device.id}`}
                className="block rounded-lg border bg-[var(--card)] p-4 transition-colors hover:bg-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">
                        {device.name ?? `Máquina ${device.id}`}
                      </h2>
                      {off ? (
                        <Badge variant="secondary" className="gap-1">
                          <Power className="size-3" /> desligada
                        </Badge>
                      ) : (
                        <Badge variant="success" className="gap-1">
                          <Zap className="size-3" /> ligada
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      ID #{device.id}{" "}
                      <span className="text-[var(--muted-foreground)]/70">· {device.external_id}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    {!off ? (
                      <>
                        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                          Resta
                        </p>
                        <p className="text-lg font-bold tabular-nums">{formatDuration(remaining)}</p>
                      </>
                    ) : (
                      <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/">Trocar empresa</Link>
      </Button>
    </main>
  );
}
