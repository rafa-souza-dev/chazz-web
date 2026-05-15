"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type CompanyFormFields = {
  name: string;
  nightRate: number | null;
  nightStart: number | null;
  nightEnd: number | null;
};

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; company: Company }
  | { kind: "delete"; company: Company };

export default function AdminCompaniesPage() {
  const router = useRouter();
  const { loading: authLoading, isSuperadmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperadmin) {
      router.replace("/admin");
      return;
    }
    api
      .get<Company[]>("/companies")
      .then((res) => setCompanies(res.data))
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar empresas")))
      .finally(() => setLoading(false));
  }, [authLoading, isSuperadmin, router]);

  const closeDialog = () => setDialog({ kind: "closed" });

  async function handleCreate(fields: CompanyFormFields) {
    try {
      const res = await api.post<Company>("/companies", {
        name: fields.name,
        nightRate: fields.nightRate,
        nightStart: fields.nightStart,
        nightEnd: fields.nightEnd,
      });
      setCompanies((current) => [...current, res.data]);
      toast.success("Empresa criada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao criar"));
    }
  }

  async function handleEdit(company: Company, fields: CompanyFormFields) {
    try {
      const res = await api.put<Company>(`/companies/${company.id}`, {
        name: fields.name,
        nightRate: fields.nightRate,
        nightStart: fields.nightStart,
        nightEnd: fields.nightEnd,
      });
      setCompanies((current) => current.map((c) => (c.id === company.id ? res.data : c)));
      toast.success("Empresa atualizada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao atualizar"));
    }
  }

  async function handleDelete(company: Company) {
    try {
      await api.delete(`/companies/${company.id}`);
      setCompanies((current) => current.filter((c) => c.id !== company.id));
      toast.success("Empresa removida");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao remover"));
    }
  }

  if (!isSuperadmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {companies.length} {companies.length === 1 ? "empresa" : "empresas"} cadastradas.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })} className="gap-2">
          <Plus className="size-4" /> Nova empresa
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Carregando...
          </CardContent>
        </Card>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Nenhuma empresa cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {companies.map((company) => (
            <div
              key={company.id}
              className="flex items-center justify-between rounded-lg border bg-[var(--card)] p-3"
            >
              <div>
                <p className="font-medium">{company.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  ID #{company.id}
                  {company.night_rate != null && (
                    <span className="ml-2">· Tarifa noturna: +{company.night_rate}%</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "edit", company })} className="gap-2">
                  <Pencil className="size-3" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDialog({ kind: "delete", company })} className="gap-2">
                  <Trash2 className="size-3" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog.kind === "create" ? (
        <CompanyDialog
          title="Nova empresa"
          onClose={closeDialog}
          onSave={async (fields) => {
            await handleCreate(fields);
            closeDialog();
          }}
        />
      ) : null}

      {dialog.kind === "edit" ? (
        <CompanyDialog
          title="Editar empresa"
          initial={dialog.company}
          onClose={closeDialog}
          onSave={async (fields) => {
            await handleEdit(dialog.company, fields);
            closeDialog();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={dialog.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Excluir empresa"
        description={
          dialog.kind === "delete"
            ? `Excluir a empresa "${dialog.company.name}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (dialog.kind === "delete") await handleDelete(dialog.company);
        }}
      />
    </div>
  );
}

function CompanyDialog({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: { name: string; night_rate: number | null; night_start: number | null; night_end: number | null };
  onClose: () => void;
  onSave: (fields: CompanyFormFields) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nightRateStr, setNightRateStr] = useState(initial?.night_rate != null ? String(initial.night_rate) : "");
  const [nightStartStr, setNightStartStr] = useState(initial?.night_start != null ? String(initial.night_start) : "18");
  const [nightEndStr, setNightEndStr] = useState(initial?.night_end != null ? String(initial.night_end) : "6");
  const [submitting, setSubmitting] = useState(false);

  const nightRate = nightRateStr === "" ? null : Number(nightRateStr);
  const nightStart = nightStartStr === "" ? null : Number(nightStartStr);
  const nightEnd = nightEndStr === "" ? null : Number(nightEndStr);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="company-name">Nome</Label>
            <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="night-rate">Taxa noturna (%)</Label>
            <Input
              id="night-rate"
              type="number"
              min={1}
              max={100}
              placeholder="Ex: 10 (deixe vazio para desativar)"
              value={nightRateStr}
              onChange={(e) => setNightRateStr(e.target.value)}
            />
          </div>
          {nightRate !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="night-start">Início (hora, 0-23)</Label>
                <Input
                  id="night-start"
                  type="number"
                  min={0}
                  max={23}
                  placeholder="18"
                  value={nightStartStr}
                  onChange={(e) => setNightStartStr(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="night-end">Fim (hora, 0-23)</Label>
                <Input
                  id="night-end"
                  type="number"
                  min={0}
                  max={23}
                  placeholder="6"
                  value={nightEndStr}
                  onChange={(e) => setNightEndStr(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={submitting || !name.trim()}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSave({ name: name.trim(), nightRate, nightStart, nightEnd });
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
