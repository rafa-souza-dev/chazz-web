"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Plus, Power, RefreshCcw, Trash2, Zap } from "lucide-react";
import { api, getApiErrorMessage, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isDeviceUpdateEvent, type Company, type Device } from "@/lib/types";
import { formatDuration, getRemainingMs, isDeviceOff } from "@/lib/devices";
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

type DialogState =
  | { kind: "closed" }
  | { kind: "rename"; device: Device }
  | { kind: "create" }
  | { kind: "edit"; device: Device }
  | { kind: "delete"; device: Device }
  | { kind: "turn-off"; device: Device }
  | { kind: "release"; device: Device };

export default function AdminDevicesPage() {
  const { user, isSuperadmin } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  const fetchAll = useMemo(
    () => async () => {
      if (!user) return;
      try {
        if (isSuperadmin) {
          const [devicesRes, companiesRes] = await Promise.all([
            api.get<Device[]>("/devices"),
            api.get<Company[]>("/companies"),
          ]);
          setDevices(devicesRes.data);
          setCompanies(companiesRes.data);
        } else if (user.company_id) {
          const res = await api.get<Device[]>(`/companies/${user.company_id}/devices`);
          setDevices(res.data);
        } else {
          setDevices([]);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Erro ao carregar máquinas"));
      } finally {
        setLoading(false);
      }
    },
    [user, isSuperadmin],
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

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
              ? {
                  ...d,
                  turn_off_at: data.type === "device_rescheduled" ? data.turn_off_at : null,
                }
              : d,
          ),
        );
      } catch {
        // ignore
      }
    };
    return () => ws.close();
  }, []);

  function closeDialog() {
    setDialog({ kind: "closed" });
  }

  async function handleRelease(deviceId: number, minutes: number) {
    try {
      const res = await api.post<Device>(`/devices/${deviceId}/release`, {
        seconds: minutes * 60,
      });
      setDevices((current) => current.map((d) => (d.id === deviceId ? res.data : d)));
      toast.success(`Máquina liberada por ${minutes} minutos`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao liberar máquina"));
    }
  }

  async function handleTurnOff(device: Device) {
    try {
      const res = await api.post<Device>(`/devices/${device.id}/turn-off`);
      setDevices((current) => current.map((d) => (d.id === device.id ? res.data : d)));
      toast.success("Máquina desligada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao desligar máquina"));
    }
  }

  async function handleSaveRename(device: Device, name: string) {
    try {
      const res = await api.patch<Device>(`/devices/${device.id}`, { name: name || null });
      setDevices((current) => current.map((d) => (d.id === device.id ? res.data : d)));
      toast.success("Nome atualizado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao renomear"));
    }
  }

  async function handleCreate(payload: { external_id: string; name: string | null; company_id: number | null }) {
    try {
      const res = await api.post<Device>("/devices", payload);
      setDevices((current) => [...current, res.data]);
      toast.success("Máquina criada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao criar máquina"));
    }
  }

  async function handleEdit(device: Device, payload: { external_id: string; name: string | null; company_id: number | null }) {
    try {
      const res = await api.put<Device>(`/devices/${device.id}`, payload);
      setDevices((current) => current.map((d) => (d.id === device.id ? res.data : d)));
      toast.success("Máquina atualizada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao atualizar"));
    }
  }

  async function handleDelete(device: Device) {
    try {
      await api.delete(`/devices/${device.id}`);
      setDevices((current) => current.filter((d) => d.id !== device.id));
      toast.success("Máquina removida");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao remover"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Máquinas</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {isSuperadmin
              ? "Todas as máquinas do sistema."
              : `Máquinas da sua empresa (${devices.length}).`}
          </p>
        </div>
        {isSuperadmin ? (
          <Button onClick={() => setDialog({ kind: "create" })} className="gap-2">
            <Plus className="size-4" /> Nova máquina
          </Button>
        ) : null}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Carregando máquinas...
          </CardContent>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Nenhuma máquina disponível.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {devices.map((device) => {
            const off = isDeviceOff(device.turn_off_at, nowMs);
            const remaining = !off && device.turn_off_at ? getRemainingMs(device.turn_off_at, nowMs) : 0;
            return (
              <Card key={device.id}>
                <CardContent className="space-y-3 p-4">
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
                        ID #{device.id} · ext {device.external_id}
                        {device.company_id ? ` · company #${device.company_id}` : " · sem empresa"}
                      </p>
                      {!off ? (
                        <p className="text-sm">
                          Resta <span className="font-bold tabular-nums">{formatDuration(remaining)}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "rename", device })} className="gap-2">
                        <Pencil className="size-3" /> Renomear
                      </Button>
                      {isSuperadmin ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "edit", device })}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDialog({ kind: "delete", device })} className="gap-2">
                            <Trash2 className="size-3" /> Excluir
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default" onClick={() => setDialog({ kind: "release", device })} className="gap-2">
                      <RefreshCcw className="size-3" /> Liberar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "turn-off", device })} className="gap-2">
                      <Power className="size-3" /> Desligar
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/admin/devices/${device.id}/cycles`}>Ciclos</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dialog.kind === "rename" ? (
        <RenameDialog
          device={dialog.device}
          onClose={closeDialog}
          onSave={(name) => handleSaveRename(dialog.device, name)}
        />
      ) : null}

      {dialog.kind === "release" ? (
        <ReleaseDialog
          device={dialog.device}
          onClose={closeDialog}
          onConfirm={async (minutes) => {
            await handleRelease(dialog.device.id, minutes);
            closeDialog();
          }}
        />
      ) : null}

      {dialog.kind === "create" ? (
        <DeviceFormDialog
          title="Nova máquina"
          companies={companies}
          isSuperadmin={isSuperadmin}
          defaultCompanyId={user?.company_id ?? null}
          onClose={closeDialog}
          onSave={async (payload) => {
            await handleCreate(payload);
            closeDialog();
          }}
        />
      ) : null}

      {dialog.kind === "edit" ? (
        <DeviceFormDialog
          title="Editar máquina"
          companies={companies}
          isSuperadmin={isSuperadmin}
          device={dialog.device}
          onClose={closeDialog}
          onSave={async (payload) => {
            await handleEdit(dialog.device, payload);
            closeDialog();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={dialog.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Excluir máquina"
        description={
          dialog.kind === "delete"
            ? `Tem certeza que deseja excluir "${dialog.device.name ?? `Máquina ${dialog.device.id}`}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (dialog.kind === "delete") {
            await handleDelete(dialog.device);
          }
        }}
      />

      <ConfirmDialog
        open={dialog.kind === "turn-off"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Forçar desligamento"
        description={
          dialog.kind === "turn-off"
            ? `Desligar imediatamente "${dialog.device.name ?? `Máquina ${dialog.device.id}`}"? O tempo restante será descartado.`
            : undefined
        }
        confirmLabel="Desligar"
        variant="destructive"
        onConfirm={async () => {
          if (dialog.kind === "turn-off") {
            await handleTurnOff(dialog.device);
          }
        }}
      />
    </div>
  );
}

function RenameDialog({
  device,
  onClose,
  onSave,
}: {
  device: Device;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(device.name ?? "");
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear máquina</DialogTitle>
          <DialogDescription>Defina um nome amigável para a máquina.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="device-name">Nome</Label>
          <Input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Máquina ${device.id}`}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSave(name.trim());
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDialog({
  device,
  onClose,
  onConfirm,
}: {
  device: Device;
  onClose: () => void;
  onConfirm: (minutes: number) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar máquina</DialogTitle>
          <DialogDescription>
            Por quantos minutos deseja liberar &quot;{device.name ?? `Máquina ${device.id}`}&quot;? (máximo 120)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="release-minutes">Minutos</Label>
          <Input
            id="release-minutes"
            type="number"
            min={1}
            max={120}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={submitting}
            onClick={async () => {
              const minutesNum = Math.round(parseFloat(minutes));
              if (!Number.isFinite(minutesNum) || minutesNum < 1 || minutesNum > 120) {
                toast.error("Informe um valor entre 1 e 120 minutos");
                return;
              }
              setSubmitting(true);
              try {
                await onConfirm(minutesNum);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Liberando..." : "Liberar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceFormDialog({
  title,
  device,
  companies,
  isSuperadmin,
  defaultCompanyId,
  onClose,
  onSave,
}: {
  title: string;
  device?: Device;
  companies: Company[];
  isSuperadmin: boolean;
  defaultCompanyId?: number | null;
  onClose: () => void;
  onSave: (payload: { external_id: string; name: string | null; company_id: number | null }) => Promise<void>;
}) {
  const [externalId, setExternalId] = useState(device?.external_id ?? "");
  const [name, setName] = useState(device?.name ?? "");
  const [companyId, setCompanyId] = useState<string>(
    device?.company_id != null
      ? String(device.company_id)
      : defaultCompanyId != null
        ? String(defaultCompanyId)
        : "",
  );
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ext">External ID (Tuya)</Label>
            <Input id="ext" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {isSuperadmin ? (
            <div className="space-y-1">
              <Label htmlFor="company">Empresa</Label>
              <select
                id="company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm"
              >
                <option value="">Sem empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name} (#{c.id})</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={submitting || !externalId.trim()}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSave({
                  external_id: externalId.trim(),
                  name: name.trim() ? name.trim() : null,
                  company_id: companyId ? Number(companyId) : null,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
