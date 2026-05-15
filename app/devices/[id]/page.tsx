"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { ChevronLeft, Check, Copy, Power, Ticket, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiPublic, API_BASE_URL, getApiErrorMessage } from "@/lib/api";
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
import {
  isDeviceUpdateEvent,
  isChargePaidEvent,
  type Device,
  type DeviceCycle,
  type ChargePayload,
} from "@/lib/types";
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

  const [pixOpen, setPixOpen] = useState(false);
  const [pixCharge, setPixCharge] = useState<ChargePayload | null>(null);
  const [pixCycleId, setPixCycleId] = useState<number | null>(null);
  const [pixLoadingCycleId, setPixLoadingCycleId] = useState<number | null>(null);
  const [pixExpiryMs, setPixExpiryMs] = useState(0);
  const [pixCopied, setPixCopied] = useState(false);
  const pixCycleIdRef = useRef<number | null>(null);

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
    pixCycleIdRef.current = pixCycleId;
  }, [pixCycleId]);

  useEffect(() => {
    if (!pixOpen || !pixCharge) return;
    const target = new Date(pixCharge.expiresAt).getTime();
    const tick = () => {
      const rem = target - Date.now();
      if (rem <= 0) {
        setPixOpen(false);
        return;
      }
      setPixExpiryMs(rem);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [pixOpen, pixCharge]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as unknown;
        if (isDeviceUpdateEvent(data)) {
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
          return;
        }
        if (isChargePaidEvent(data) && data.cycle_id === pixCycleIdRef.current) {
          setPixOpen(false);
          toast.success("Pagamento confirmado");
        }
      } catch {
        // ignore
      }
    };
    return () => ws.close();
  }, [deviceId]);

  const off = device ? isDeviceOff(device.turn_off_at, nowMs) : true;
  const remainingMs = device && device.turn_off_at && !off ? getRemainingMs(device.turn_off_at, nowMs) : 0;
  const sortedCycles = useMemo(() => [...cycles].sort((a, b) => a.cents - b.cents), [cycles]);

  async function handlePayCycle(cycle: DeviceCycle) {
    setPixLoadingCycleId(cycle.id);
    try {
      const res = await apiPublic.post<ChargePayload>(
        `/devices/${deviceId}/cycles/${cycle.id}/pay`,
      );
      setPixCharge(res.data);
      setPixCycleId(cycle.id);
      setPixOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Erro ao gerar cobrança"));
    } finally {
      setPixLoadingCycleId(null);
    }
  }

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
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCents(cycle.cents)}</span>
                  <Button
                    size="sm"
                    onClick={() => handlePayCycle(cycle)}
                    disabled={pixLoadingCycleId === cycle.id}
                  >
                    {pixLoadingCycleId === cycle.id ? "Aguarde..." : "Realizar pagamento"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--muted-foreground)]">
          Clique em <strong>Realizar pagamento</strong> no ciclo desejado para gerar o QR Code Pix ou utilize um cupom acima.
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

      <Dialog open={pixOpen} onOpenChange={(open) => { setPixOpen(open); if (!open) setPixCopied(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar com Pix</DialogTitle>
            <DialogDescription className="text-zinc-400 dark:text-zinc-300">
              Escaneie o QR code ou copie o código Pix.
              {pixExpiryMs > 0 && (
                <>
                  {" "}
                  Expira em{" "}
                  <span className="font-semibold tabular-nums">
                    {formatDuration(pixExpiryMs)}
                  </span>
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {pixCharge && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-4 shadow-sm">
                <QRCode value={pixCharge.brCode} size={192} />
              </div>
              <Button
                variant="outline"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 hover:border-emerald-600 gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(pixCharge.brCode);
                  setPixCopied(true);
                  toast.success("Código copiado!");
                }}
              >
                {pixCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {pixCopied ? "Copiado" : "Copiar código Pix"}
              </Button>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
