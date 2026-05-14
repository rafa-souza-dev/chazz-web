"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Company, Coupon, Device } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatSecondsHuman } from "@/lib/format";

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "delete"; coupon: Coupon }
  | { kind: "success"; coupon: Coupon };

export default function AdminCouponsPage() {
  const { user, isSuperadmin } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const promises: [Promise<{ data: Coupon[] }>, Promise<{ data: Device[] }>, Promise<{ data: Company[] }>] = [
      api.get<Coupon[]>("/coupons"),
      isSuperadmin
        ? api.get<Device[]>("/devices")
        : user.company_id
          ? api.get<Device[]>(`/companies/${user.company_id}/devices`)
          : Promise.resolve({ data: [] as Device[] } as { data: Device[] }),
      isSuperadmin
        ? api.get<Company[]>("/companies")
        : Promise.resolve({ data: [] as Company[] } as { data: Company[] }),
    ];
    Promise.all(promises)
      .then(([couponsRes, devicesRes, companiesRes]) => {
        setCoupons(couponsRes.data);
        setDevices(devicesRes.data);
        setCompanies(companiesRes.data);
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar cupons")))
      .finally(() => setLoading(false));
  }, [user, isSuperadmin]);

  const closeDialog = () => setDialog({ kind: "closed" });

  async function handleCreate(payload: {
    device_id: number;
    company_id: number;
    valid_until: string;
    release_seconds: number;
  }): Promise<Coupon | null> {
    try {
      const res = await api.post<Coupon>("/coupons", payload);
      setCoupons((current) => [res.data, ...current]);
      return res.data;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao criar cupom"));
      return null;
    }
  }

  async function handleDelete(coupon: Coupon) {
    try {
      await api.delete(`/coupons/${coupon.id}`);
      setCoupons((current) => current.filter((c) => c.id !== coupon.id));
      toast.success("Cupom removido");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao remover"));
    }
  }

  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cupons</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {isSuperadmin
              ? "Todos os cupons emitidos no sistema."
              : "Cupons emitidos pela sua empresa."}
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })} className="gap-2">
          <Plus className="size-4" /> Novo cupom
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Carregando cupons...
          </CardContent>
        </Card>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Nenhum cupom emitido ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Máquina</TableHead>
                  {isSuperadmin ? <TableHead>Empresa</TableHead> : null}
                  <TableHead>Duração</TableHead>
                  <TableHead>Válido até</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const device = deviceById.get(coupon.device_id);
                  const company = companyById.get(coupon.company_id);
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1">
                          <span>{coupon.code}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={async () => {
                              await navigator.clipboard.writeText(coupon.code);
                              toast.success("Código copiado");
                            }}
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {device?.name ?? `Máquina ${coupon.device_id}`}
                      </TableCell>
                      {isSuperadmin ? (
                        <TableCell className="text-xs">
                          {company?.name ?? `Empresa ${coupon.company_id}`}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-xs">{formatSecondsHuman(coupon.release_seconds)}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(coupon.valid_until)}</TableCell>
                      <TableCell>
                        {coupon.used ? (
                          <Badge variant="secondary">usado</Badge>
                        ) : new Date(coupon.valid_until).getTime() < nowMs ? (
                          <Badge variant="outline">expirado</Badge>
                        ) : (
                          <Badge variant="success">ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDialog({ kind: "delete", coupon })}
                          className="gap-1"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dialog.kind === "create" ? (
        <CouponFormDialog
          devices={devices}
          companies={companies}
          isSuperadmin={isSuperadmin}
          defaultCompanyId={user?.company_id ?? null}
          onClose={closeDialog}
          onSave={async (payload) => {
            const created = await handleCreate(payload);
            setDialog(created ? { kind: "success", coupon: created } : { kind: "closed" });
          }}
        />
      ) : null}

      {dialog.kind === "success" ? (
        <CouponCreatedDialog
          coupon={dialog.coupon}
          device={deviceById.get(dialog.coupon.device_id)}
          onClose={closeDialog}
        />
      ) : null}

      <ConfirmDialog
        open={dialog.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Remover cupom"
        description={
          dialog.kind === "delete" ? `Remover o cupom ${dialog.coupon.code}?` : undefined
        }
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={async () => {
          if (dialog.kind === "delete") await handleDelete(dialog.coupon);
        }}
      />
    </div>
  );
}

function CouponFormDialog({
  devices,
  companies,
  isSuperadmin,
  defaultCompanyId,
  onClose,
  onSave,
}: {
  devices: Device[];
  companies: Company[];
  isSuperadmin: boolean;
  defaultCompanyId: number | null;
  onClose: () => void;
  onSave: (payload: {
    device_id: number;
    company_id: number;
    valid_until: string;
    release_seconds: number;
  }) => Promise<void>;
}) {
  const [companyId, setCompanyId] = useState<string>(
    defaultCompanyId ? String(defaultCompanyId) : isSuperadmin && companies.length > 0 ? String(companies[0].id) : "",
  );
  const [deviceId, setDeviceId] = useState<string>("");
  const [minutes, setMinutes] = useState("30");
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [submitting, setSubmitting] = useState(false);

  const filteredDevices = useMemo(() => {
    if (!companyId) return devices.filter((d) => d.company_id === null);
    return devices.filter((d) => d.company_id === Number(companyId));
  }, [devices, companyId]);

  useEffect(() => {
    if (filteredDevices.length > 0 && !filteredDevices.some((d) => String(d.id) === deviceId)) {
      setDeviceId(String(filteredDevices[0].id));
    }
    if (filteredDevices.length === 0) setDeviceId("");
  }, [filteredDevices, deviceId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cupom</DialogTitle>
          <DialogDescription>Gere um código que libera a máquina pelo tempo escolhido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isSuperadmin ? (
            <div className="space-y-1">
              <Label htmlFor="company">Empresa</Label>
              <select
                id="company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="device">Máquina</Label>
            <select
              id="device"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm"
            >
              {filteredDevices.length === 0 ? (
                <option value="">Sem máquinas para essa empresa</option>
              ) : (
                filteredDevices.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name ?? `Máquina ${d.id}`}</option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="minutes">Duração (minutos)</Label>
            <Input
              id="minutes"
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="valid">Válido até</Label>
            <Input
              id="valid"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={submitting || !deviceId || !companyId || !minutes || !validUntil}
            onClick={async () => {
              const minutesNum = Math.round(parseFloat(minutes));
              if (!Number.isFinite(minutesNum) || minutesNum <= 0) {
                toast.error("Duração inválida");
                return;
              }
              const validDate = new Date(validUntil);
              if (isNaN(validDate.getTime()) || validDate.getTime() <= Date.now()) {
                toast.error("Data de validade inválida");
                return;
              }
              setSubmitting(true);
              try {
                await onSave({
                  device_id: Number(deviceId),
                  company_id: Number(companyId),
                  valid_until: validDate.toISOString(),
                  release_seconds: minutesNum * 60,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Gerando..." : "Gerar cupom"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CouponCreatedDialog({
  coupon,
  device,
  onClose,
}: {
  coupon: Coupon;
  device: Device | undefined;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <DialogTitle>Cupom gerado</DialogTitle>
          </div>
          <DialogDescription>
            Copie o código abaixo e envie ao cliente para liberar a máquina.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border bg-[var(--secondary)] p-4">
          <span className="select-all font-mono text-2xl font-bold tracking-wider">
            {coupon.code}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
            aria-label="Copiar código do cupom"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <div className="space-y-1 text-sm text-[var(--muted-foreground)]">
          {device ? (
            <p>
              Máquina:{" "}
              <span className="text-[var(--foreground)]">
                {device.name ?? `Máquina ${device.id}`}
              </span>
            </p>
          ) : null}
          <p>
            Duração:{" "}
            <span className="text-[var(--foreground)]">
              {formatSecondsHuman(coupon.release_seconds)}
            </span>
          </p>
          <p>
            Válido até:{" "}
            <span className="text-[var(--foreground)]">
              {formatDateTime(coupon.valid_until)}
            </span>
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Concluído</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
