"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Transaction } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, formatDateTime } from "@/lib/format";

type SortField = "paid_at" | "value_cents";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline ml-1 h-3 w-3" />
    : <ChevronDown className="inline ml-1 h-3 w-3" />;
}

export default function AdminTransactionsPage() {
  const { user, isSuperadmin } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("paid_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!user) return;
    const req = isSuperadmin
      ? api.get<Transaction[]>("/transactions")
      : user.company_id
        ? api.get<Transaction[]>(`/companies/${user.company_id}/transactions`)
        : Promise.resolve({ data: [] as Transaction[] });

    req
      .then((res) => setTransactions(res.data))
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar transações")))
      .finally(() => setLoading(false));
  }, [user, isSuperadmin]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (minValue !== "" && tx.value_cents < parseFloat(minValue) * 100) return false;
        if (maxValue !== "" && tx.value_cents > parseFloat(maxValue) * 100) return false;
        if (dateFrom !== "" && new Date(tx.paid_at) < new Date(dateFrom)) return false;
        if (dateTo !== "") {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (new Date(tx.paid_at) > end) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const av = sortField === "paid_at" ? new Date(a.paid_at).getTime() : a.value_cents;
        const bv = sortField === "paid_at" ? new Date(b.paid_at).getTime() : b.value_cents;
        return sortDir === "asc" ? av - bv : bv - av;
      });
  }, [transactions, minValue, maxValue, dateFrom, dateTo, sortField, sortDir]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transações</h1>

      <Card>
        <CardContent className="pt-4 pb-4">
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="date-from">Data inicial</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="date-to">Data final</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-[var(--muted-foreground)]">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">Nenhuma transação encontrada.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("paid_at")}
                  >
                    Data <SortIcon field="paid_at" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("value_cents")}
                  >
                    Valor <SortIcon field="value_cents" sortField={sortField} sortDir={sortDir} />
                  </TableHead>
                  <TableHead>Correlation ID</TableHead>
                  {isSuperadmin && <TableHead>Empresa</TableHead>}
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
