"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import type { Device, DeviceCycle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCents, formatSecondsHuman } from "@/lib/format";

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; cycle: DeviceCycle }
  | { kind: "delete"; cycle: DeviceCycle };

export default function AdminDeviceCyclesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const deviceId = Number(id);

  const [device, setDevice] = useState<Device | null>(null);
  const [cycles, setCycles] = useState<DeviceCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  useEffect(() => {
    if (!Number.isFinite(deviceId)) return;
    Promise.all([
      api.get<Device>(`/devices/${deviceId}`),
      api.get<DeviceCycle[]>(`/devices/${deviceId}/cycles`),
    ])
      .then(([deviceRes, cyclesRes]) => {
        setDevice(deviceRes.data);
        setCycles(cyclesRes.data);
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar ciclos")))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const sortedCycles = useMemo(() => [...cycles].sort((a, b) => a.cents - b.cents), [cycles]);

  function closeDialog() {
    setDialog({ kind: "closed" });
  }

  async function handleCreate(payload: { cents: number; seconds: number }) {
    try {
      const res = await api.post<DeviceCycle>(`/devices/${deviceId}/cycles`, payload);
      setCycles((current) => [...current, res.data]);
      toast.success("Ciclo criado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao criar ciclo"));
    }
  }

  async function handleEdit(cycle: DeviceCycle, payload: { cents: number; seconds: number }) {
    try {
      const res = await api.put<DeviceCycle>(`/devices/${deviceId}/cycles/${cycle.id}`, payload);
      setCycles((current) => current.map((c) => (c.id === cycle.id ? res.data : c)));
      toast.success("Ciclo atualizado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao atualizar"));
    }
  }

  async function handleDelete(cycle: DeviceCycle) {
    try {
      await api.delete(`/devices/${deviceId}/cycles/${cycle.id}`);
      setCycles((current) => current.filter((c) => c.id !== cycle.id));
      toast.success("Ciclo removido");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao remover"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/admin/devices"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Máquinas
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Ciclos de {device?.name ?? `Máquina ${deviceId}`}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {sortedCycles.length}{" "}
              {sortedCycles.length === 1 ? "ciclo" : "ciclos"} cadastrados.
            </p>
          </div>
          <Button onClick={() => setDialog({ kind: "create" })} className="gap-2">
            <Plus className="size-4" /> Novo ciclo
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Carregando...
          </CardContent>
        </Card>
      ) : sortedCycles.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Nenhum ciclo cadastrado. Crie um ciclo para permitir que pagamentos liberem esta máquina.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {sortedCycles.map((cycle) => (
            <div
              key={cycle.id}
              className="flex items-center justify-between rounded-lg border bg-[var(--card)] p-3"
            >
              <div>
                <p className="text-sm font-medium">{formatCents(cycle.cents)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {formatSecondsHuman(cycle.seconds)} de uso · {cycle.seconds}s
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "edit", cycle })} className="gap-2">
                  <Pencil className="size-3" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDialog({ kind: "delete", cycle })} className="gap-2">
                  <Trash2 className="size-3" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog.kind === "create" ? (
        <CycleFormDialog
          title="Novo ciclo"
          onClose={closeDialog}
          onSave={async (payload) => {
            await handleCreate(payload);
            closeDialog();
          }}
        />
      ) : null}

      {dialog.kind === "edit" ? (
        <CycleFormDialog
          title="Editar ciclo"
          cycle={dialog.cycle}
          onClose={closeDialog}
          onSave={async (payload) => {
            await handleEdit(dialog.cycle, payload);
            closeDialog();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={dialog.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Excluir ciclo"
        description={
          dialog.kind === "delete"
            ? `Tem certeza que deseja remover o ciclo de ${formatCents(dialog.cycle.cents)}?`
            : undefined
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (dialog.kind === "delete") await handleDelete(dialog.cycle);
        }}
      />
    </div>
  );
}

function CycleFormDialog({
  title,
  cycle,
  onClose,
  onSave,
}: {
  title: string;
  cycle?: DeviceCycle;
  onClose: () => void;
  onSave: (payload: { cents: number; seconds: number }) => Promise<void>;
}) {
  const [reais, setReais] = useState(cycle ? (cycle.cents / 100).toFixed(2) : "");
  const [minutes, setMinutes] = useState(cycle ? String(Math.round(cycle.seconds / 60)) : "");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure quanto custa e quanto tempo de uso o cliente ganha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="price">Preço (R$)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              value={reais}
              onChange={(e) => setReais(e.target.value)}
            />
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
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={submitting || !reais || !minutes}
            onClick={async () => {
              const centsValue = Math.round(parseFloat(reais) * 100);
              const secondsValue = Math.round(parseFloat(minutes) * 60);
              if (!Number.isFinite(centsValue) || centsValue <= 0) {
                toast.error("Preço inválido");
                return;
              }
              if (!Number.isFinite(secondsValue) || secondsValue <= 0) {
                toast.error("Duração inválida");
                return;
              }
              setSubmitting(true);
              try {
                await onSave({ cents: centsValue, seconds: secondsValue });
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
