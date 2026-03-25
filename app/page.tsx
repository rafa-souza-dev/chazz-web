"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type Device,
  formatDuration,
  getRemainingMs,
  isDeviceOff,
  isDeviceRescheduledEvent,
  normalizeDevices,
} from "@/lib/devices";

const API_BASE_URL = process.env.NEXT_PUBLIC_CHAZZ_API_URL ?? "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_CHAZZ_WS_URL ?? deriveWsUrl(API_BASE_URL);

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

export default function Home() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const abortController = new AbortController();

    async function loadDevices() {
      try {
        setError(null);
        const response = await fetch(`${API_BASE_URL}/devices`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar devices (${response.status})`);
        }

        const payload: unknown = await response.json();
        setDevices(normalizeDevices(payload));
      } catch (loadError) {
        if (abortController.signal.aborted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Erro inesperado ao carregar devices";
        setError(message);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDevices();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const data: unknown = JSON.parse(event.data);
        if (!isDeviceRescheduledEvent(data)) {
          return;
        }

        setDevices((currentDevices) =>
          currentDevices.map((device) =>
            device.id === data.device_id ? { ...device, turn_off_at: data.turn_off_at } : device,
          ),
        );
      } catch {
        // Ignora mensagens inválidas.
      }
    };

    return () => ws.close();
  }, []);

  const devicesCountLabel = useMemo(() => {
    if (devices.length === 1) {
      return "1 máquina";
    }

    return `${devices.length} máquinas`;
  }, [devices.length]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 md:max-w-2xl">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Painel de Máquinas</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{devicesCountLabel}</p>
        </header>

        {loading ? (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm">Carregando máquinas...</p>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800/60 dark:bg-red-950/40">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </section>
        ) : null}

        {!loading && !error && devices.length === 0 ? (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm">Nenhuma máquina cadastrada.</p>
          </section>
        ) : null}

        {!loading && !error
          ? devices.map((device) => {
              const off = isDeviceOff(device.turn_off_at, nowMs);
              const remainingMs = !off && device.turn_off_at ? getRemainingMs(device.turn_off_at, nowMs) : 0;
              const timer = formatDuration(remainingMs);

              return (
                <section
                  key={device.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">Maquina {device.id}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        off
                          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }`}
                    >
                      {off ? "Desligada" : "Ligada"}
                    </span>
                  </div>

                  {!off ? (
                    <div className="mt-4 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800/80">
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Tempo para desligar
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">{timer}</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                      Esta maquina esta desligada.
                    </p>
                  )}
                </section>
              );
            })
          : null}
      </main>
    </div>
  );
}
