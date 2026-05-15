"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const API_BASE_URL = process.env.NEXT_PUBLIC_CHAZZ_API_URL ?? "http://localhost:3000";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type ServiceStatus = { status: "ok" | "error"; error?: string };
type WebSocketStatus = ServiceStatus & { clients?: number };

interface StatusResponse {
  backend: ServiceStatus;
  database: ServiceStatus;
  tuya: ServiceStatus;
  websocket: WebSocketStatus;
  woovi: ServiceStatus;
  cached_at: string;
  timestamp: string;
}

function StatusIndicator({ status }: { status: "ok" | "error" | "loading" }) {
  if (status === "loading") {
    return (
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--muted-foreground)]" />
    );
  }
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${
        status === "ok"
          ? "bg-emerald-500"
          : "bg-red-500"
      }`}
    />
  );
}

function StatusBadge({ status }: { status: "ok" | "error" | "loading" }) {
  if (status === "loading") {
    return (
      <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
        Verificando...
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        status === "ok"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      }`}
    >
      {status === "ok" ? "Operacional" : "Falha"}
    </span>
  );
}

interface ServiceCardProps {
  title: string;
  description: string;
  serviceStatus: ServiceStatus | WebSocketStatus | null;
  loading: boolean;
  extra?: React.ReactNode;
}

function ServiceCard({ title, description, serviceStatus, loading, extra }: ServiceCardProps) {
  const status = loading ? "loading" : serviceStatus?.status ?? "error";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status={status} />
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {!loading && serviceStatus?.status === "error" && serviceStatus.error ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          <p className="text-xs text-red-700 dark:text-red-300">{serviceStatus.error}</p>
        </div>
      ) : null}

      {!loading && extra ? <div className="mt-3">{extra}</div> : null}
    </Card>
  );
}

export default function StatusPage() {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/status`, { signal });

      if (!response.ok) {
        throw new Error(`Falha ao buscar status (${response.status})`);
      }

      const data: StatusResponse = await response.json();
      setStatusData(data);
      setLastFetchedAt(new Date());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Erro inesperado ao buscar status";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    fetchStatus(abortController.signal);

    const interval = window.setInterval(() => {
      fetchStatus(abortController.signal);
    }, REFRESH_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [fetchStatus]);


  const isCached =
    statusData && statusData.cached_at !== statusData.timestamp;

  return (
    <div className="min-h-screen px-4 py-6">
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 md:max-w-2xl">
        <header className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Status do Sistema</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStatus()}
              disabled={loading}
            >
              {loading ? "Verificando..." : "Atualizar"}
            </Button>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Monitoramento dos serviços da plataforma Chazz
          </p>
        </header>

        {error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-800/60 dark:bg-red-950/40">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </section>
        ) : null}

        <div className="flex flex-col gap-3">
          <ServiceCard
            title="Backend"
            description="API HTTP do servidor"
            serviceStatus={statusData?.backend ?? null}
            loading={loading}
          />
          <ServiceCard
            title="Banco de Dados"
            description="Conexão com o banco PostgreSQL via Prisma"
            serviceStatus={statusData?.database ?? null}
            loading={loading}
          />
          <ServiceCard
            title="Tuya"
            description="API HTTP Tuya"
            serviceStatus={statusData?.tuya ?? null}
            loading={loading}
          />
          <ServiceCard
            title="WebSocket"
            description="Servidor de eventos em tempo real"
            serviceStatus={statusData?.websocket ?? null}
            loading={loading}
          />
          <ServiceCard
            title="Woovi"
            description="Gateway de pagamentos Pix"
            serviceStatus={statusData?.woovi ?? null}
            loading={loading}
          />
        </div>

        {!loading && lastFetchedAt ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Última verificação: {lastFetchedAt.toLocaleTimeString("pt-BR")}
            {isCached ? " · Resposta em cache (atualiza a cada 5 min)" : ""}
          </p>
        ) : null}

        <nav>
          <Link
            href="/"
            className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
          >
            ← Voltar ao painel
          </Link>
        </nav>
      </main>
    </div>
  );
}
