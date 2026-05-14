"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ChevronLeft, Power, Ticket, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiPublic, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeviceUpdateEvent, type Device, type DeviceCycle } from "@/lib/types";
import { formatCents, formatSecondsHuman } from "@/lib/format";
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

export default function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const deviceId = Number(id);

  const [device, setDevice] = useState<Device | null>(null);
  const [cycles, setCycles] = useState<DeviceCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponSubmitting, setCouponSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(deviceId)) {
      setError("ID de máquina inválido");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      apiPublic.get<Device>(`/devices/${deviceId}`, { signal: controller.signal }),
      apiPublic.get<DeviceCycle[]>(`/devices/${deviceId}/cycles`, { signal: controller.signal }),
    ])
      .then(([deviceRes, cyclesRes]) => {
        setDevice(deviceRes.data);
        setCycles(cyclesRes.data);
      })
      .catch((err) => {
        if (err.code !== "ERR_CANCELED") {
          setError(err.response?.data?.error ?? err.message ?? "Erro ao carregar máquina");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [deviceId]);

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
        if (data.device_id !== deviceId) return;
        setDevice((current) =>
          current
            ? {
                ...current,
                turn_off_at:
                  data.type === "device_rescheduled" ? data.turn_off_at : null,
              }
            : current,
        );
      } catch {
        // ignore
      }
    };
    return () => ws.close();
  }, [deviceId]);

  const off = device ? isDeviceOff(device.turn_off_at, nowMs) : true;
  const remainingMs = device && device.turn_off_at && !off ? getRemainingMs(device.turn_off_at, nowMs) : 0;
  const sortedCycles = useMemo(() => [...cycles].sort((a, b) => a.cents - b.cents), [cycles]);

  async function handleRedeem() {
    if (!couponCode.trim()) {
      toast.error("Informe o código do cupom");
      return;
    }
    setCouponSubmitting(true);
    try {
      const res = await apiPublic.post("/coupons/redeem", {
        code: couponCode.trim().toUpperCase(),
        device_id: deviceId,
      });
      const turnOffAt = res.data?.turn_off_at as string | undefined;
      if (turnOffAt && device) {
        setDevice({ ...device, turn_off_at: turnOffAt });
      }
      toast.success("Cupom resgatado com sucesso");
      setCouponOpen(false);
      setCouponCode("");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e.response?.data?.error ?? e.message ?? "Falha ao resgatar cupom");
    } finally {
      setCouponSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        {device?.company_id ? (
          <Link
            href={`/companies/${device.company_id}`}
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ChevronLeft className="size-4" /> Máquinas da empresa
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ChevronLeft className="size-4" /> Início
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          {loading ? "Carregando..." : device?.name ?? `Máquina ${deviceId}`}
        </h1>
        {device ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            ID #{device.id} · {device.external_id}
          </p>
        ) : null}
      </div>

      {error ? (
        <Card className="border-red-300/60 bg-red-50/60 dark:bg-red-950/30">
          <CardContent className="py-6 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      {device ? (
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              {off ? (
                <Badge variant="secondary" className="gap-1">
                  <Power className="size-3" /> desligada
                </Badge>
              ) : (
                <Badge variant="success" className="gap-1">
                  <Zap className="size-3" /> ligada
                </Badge>
              )}
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {off ? "Pronta para liberar" : "Tempo restante"}
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {off ? "00:00:00" : formatDuration(remainingMs)}
              </p>
            </div>
            <Button onClick={() => setCouponOpen(true)} className="gap-2">
              <Ticket className="size-4" /> Usar cupom
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Ciclos disponíveis</h2>
        {sortedCycles.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
              Esta máquina ainda não possui ciclos cadastrados.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedCycles.map((cycle) => (
              <li
                key={cycle.id}
                className="flex items-center justify-between rounded-lg border bg-[var(--card)] p-3"
              >
                <span className="text-sm">{formatSecondsHuman(cycle.seconds)}</span>
                <span className="text-sm font-semibold">{formatCents(cycle.cents)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--muted-foreground)]">
          Pague o valor do ciclo desejado por PIX usando o QR code da máquina ou utilize um cupom acima.
        </p>
      </section>

      <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usar cupom</DialogTitle>
            <DialogDescription>
              Informe o código do cupom para liberar esta máquina.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="coupon-code">Código</Label>
            <Input
              id="coupon-code"
              autoFocus
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="ABC12345"
            />
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleRedeem} disabled={couponSubmitting}>
              {couponSubmitting ? "Resgatando..." : "Resgatar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
