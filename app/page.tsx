"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Building2, ShieldCheck } from "lucide-react";
import { apiPublic } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Company } from "@/lib/types";

type SystemStatus = "ok" | "degraded" | "loading";

function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>("loading");
  useEffect(() => {
    const controller = new AbortController();
    apiPublic
      .get("/status", { signal: controller.signal })
      .then((res) => {
        const data = res.data as Record<string, { status: string }>;
        const services = [data.backend, data.database, data.tuya, data.websocket, data.woovi];
        setStatus(services.every((s) => s?.status === "ok") ? "ok" : "degraded");
      })
      .catch(() => setStatus("degraded"));
    return () => controller.abort();
  }, []);
  return status;
}

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = useSystemStatus();

  useEffect(() => {
    const controller = new AbortController();
    apiPublic
      .get<Company[]>("/companies", { signal: controller.signal })
      .then((res) => setCompanies(res.data))
      .catch((err) => {
        if (err.code !== "ERR_CANCELED") {
          setError(err instanceof Error ? err.message : "Erro ao carregar empresas");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Chazz</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Escolha uma empresa para ver as máquinas disponíveis.
          </p>
        </div>
        <Button variant="ghost" size="icon" asChild aria-label="Painel admin">
          <Link href="/admin/login">
            <ShieldCheck className="size-5" />
          </Link>
        </Button>
      </header>

      <Link
        href="/status"
        className={`inline-flex items-center justify-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          status === "loading"
            ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
            : status === "ok"
              ? "border-emerald-300/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "border-red-300/50 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
        }`}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${
            status === "loading"
              ? "animate-pulse bg-[var(--muted-foreground)]"
              : status === "ok"
                ? "bg-emerald-500"
                : "bg-red-500"
          }`}
        />
        {status === "loading" ? "Verificando status" : status === "ok" ? "Sistema operacional" : "Com falhas"}
      </Link>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Carregando empresas...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-300/60 bg-red-50/60 dark:bg-red-950/30">
          <CardContent className="py-6 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Nenhuma empresa cadastrada.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {companies.map((company) => (
            <li key={company.id}>
              <Link
                href={`/companies/${company.id}`}
                className="group flex items-center justify-between gap-3 rounded-lg border bg-[var(--card)] p-4 transition-colors hover:bg-[var(--accent)]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)]">
                    <Building2 className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">ID #{company.id}</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
