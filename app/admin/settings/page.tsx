"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isSuperadmin } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const [nightRateStr, setNightRateStr] = useState("");
  const [nightStartStr, setNightStartStr] = useState("18");
  const [nightEndStr, setNightEndStr] = useState("6");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (isSuperadmin || !user?.company_id) {
      router.replace("/admin");
      return;
    }
    api
      .get<Company>(`/companies/${user.company_id}`)
      .then((res) => {
        setCompany(res.data);
        setNightRateStr(res.data.night_rate != null ? String(res.data.night_rate) : "");
        setNightStartStr(res.data.night_start != null ? String(res.data.night_start) : "18");
        setNightEndStr(res.data.night_end != null ? String(res.data.night_end) : "6");
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar configurações")))
      .finally(() => setLoading(false));
  }, [authLoading, isSuperadmin, user, router]);

  const nightRate = nightRateStr === "" ? null : Number(nightRateStr);
  const nightStart = nightStartStr === "" ? null : Number(nightStartStr);
  const nightEnd = nightEndStr === "" ? null : Number(nightEndStr);

  async function handleSave() {
    if (!company) return;
    setSubmitting(true);
    try {
      const res = await api.put<Company>(`/companies/${company.id}/night-settings`, {
        nightRate,
        nightStart,
        nightEnd,
      });
      setCompany(res.data);
      toast.success("Configurações salvas");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao salvar"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !company) {
    return (
      <div className="text-sm text-[var(--muted-foreground)]">Carregando...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{company.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarifa noturna</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="night-rate">Taxa adicional (%)</Label>
            <Input
              id="night-rate"
              type="number"
              min={1}
              max={100}
              placeholder="Ex: 10 (deixe vazio para desativar)"
              value={nightRateStr}
              onChange={(e) => setNightRateStr(e.target.value)}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Percentual aplicado ao preço dos ciclos durante o período noturno. Deixe vazio para desativar.
            </p>
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
              <p className="col-span-2 text-xs text-[var(--muted-foreground)]">
                Horário de Brasília. Padrão: 18h às 6h.
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
