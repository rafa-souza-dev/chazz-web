"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Transaction, TransactionPage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, formatDateTime } from "@/lib/format";

type SortField = "paid_at" | "value_cents";
type SortDir = "asc" | "desc";
type DatePreset = "7d" | "30d" | "custom" | null;

const PAGE_SIZE = 20;

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function presetDates(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const dateTo = toYMD(today);
  if (preset === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { dateFrom: toYMD(from), dateTo };
  }
  if (preset === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { dateFrom: toYMD(from), dateTo };
  }
  return { dateFrom: "", dateTo: "" };
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline ml-1 h-3 w-3" />
    : <ChevronDown className="inline ml-1 h-3 w-3" />;
}

export default function AdminTransactionsPage() {
  const { user, isSuperadmin } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("paid_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedMin, setDebouncedMin] = useState("");
  const [debouncedMax, setDebouncedMax] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedMin(minValue);
      setDebouncedMax(maxValue);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [minValue, maxValue]);

  function selectPreset(preset: DatePreset) {
    setDatePreset(preset);
    if (preset !== "custom") {
      const dates = presetDates(preset);
      setDateFrom(dates.dateFrom);
      setDateTo(dates.dateTo);
    }
    setPage(1);
  }

  function handleDateChange(field: "dateFrom" | "dateTo", value: string) {
    if (field === "dateFrom") setDateFrom(value);
    else setDateTo(value);
    setPage(1);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sortBy", sortField);
    params.set("sortDir", sortDir);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (debouncedMin !== "") params.set("minValueCents", String(Math.round(parseFloat(debouncedMin) * 100)));
    if (debouncedMax !== "") params.set("maxValueCents", String(Math.round(parseFloat(debouncedMax) * 100)));

    const url = isSuperadmin
      ? `/transactions?${params}`
      : user.company_id
        ? `/companies/${user.company_id}/transactions?${params}`
        : null;

    if (!url) return;

    api
      .get<TransactionPage>(url)
      .then((res) => {
        setTransactions(res.data.data);
        setPagination(res.data.pagination);
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar transações")))
      .finally(() => setLoading(false));
  }, [user, isSuperadmin, page, sortField, sortDir, dateFrom, dateTo, debouncedMin, debouncedMax]);

  const presetLabel: Record<NonNullable<DatePreset>, string> = { "7d": "Últimos 7 dias", "30d": "Último mês", custom: "Personalizado" };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transações</h1>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["7d", "30d", "custom", null] as const).map((preset) => (
              <Button
                key={String(preset)}
                variant={datePreset === preset ? "default" : "outline"}
                size="sm"
                onClick={() => selectPreset(preset)}
              >
                {preset === null ? "Todos" : presetLabel[preset]}
              </Button>
            ))}
          </div>

          {datePreset === "custom" && (
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="date-from">Data inicial</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateChange("dateFrom", e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="date-to">Data final</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleDateChange("dateTo", e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="min-value">Valor mínimo (R$)</Label>
              <Input
                id="min-value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="max-value">Valor máximo (R$)</Label>
              <Input
                id="max-value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-[var(--muted-foreground)]">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">Nenhuma transação encontrada.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("paid_at")}>
                    Data <SortIcon field="paid_at" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("value_cents")}>
                    Valor <SortIcon field="value_cents" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead>Correlation ID</TableHead>
                  {isSuperadmin && <TableHead>Empresa</TableHead>}
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(tx.paid_at)}</TableCell>
                    <TableCell className="font-medium">{formatCents(tx.value_cents)}</TableCell>
                    <TableCell className="font-mono text-xs text-[var(--muted-foreground)]">
                      {tx.correlation_id.slice(0, 8)}…
                    </TableCell>
                    {isSuperadmin && (
                      <TableCell>{tx.company_name ?? <span className="text-[var(--muted-foreground)]">—</span>}</TableCell>
                    )}
                    <TableCell className="text-[var(--muted-foreground)]">#{tx.device_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--muted-foreground)]">
                Página {pagination.page} de {pagination.totalPages} &mdash; {pagination.total} transações
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
