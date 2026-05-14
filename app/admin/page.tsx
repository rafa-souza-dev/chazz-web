"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Building2, Tag, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Counts = {
  devices: number | null;
  coupons: number | null;
  companies: number | null;
  users: number | null;
};

export default function AdminDashboardPage() {
  const { user, isSuperadmin } = useAuth();
  const [counts, setCounts] = useState<Counts>({
    devices: null,
    coupons: null,
    companies: null,
    users: null,
  });

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();

    const devicesPromise = isSuperadmin
      ? api.get("/devices", { signal: controller.signal })
      : user.company_id
        ? api.get(`/companies/${user.company_id}/devices`, { signal: controller.signal })
        : Promise.resolve({ data: [] });

    const couponsPromise = api.get("/coupons", { signal: controller.signal });
    const companiesPromise = isSuperadmin
      ? api.get("/companies", { signal: controller.signal })
      : Promise.resolve({ data: null });
    const usersPromise = isSuperadmin
      ? api.get("/users", { signal: controller.signal })
      : Promise.resolve({ data: null });

    Promise.all([devicesPromise, couponsPromise, companiesPromise, usersPromise])
      .then(([devices, coupons, companies, users]) => {
        setCounts({
          devices: Array.isArray(devices.data) ? devices.data.length : null,
          coupons: Array.isArray(coupons.data) ? coupons.data.length : null,
          companies: Array.isArray(companies.data) ? companies.data.length : null,
          users: Array.isArray(users.data) ? users.data.length : null,
        });
      })
      .catch(() => {
        // We'll let cards show "—" if anything fails.
      });

    return () => controller.abort();
  }, [user, isSuperadmin]);

  const tiles = [
    { label: "Máquinas", href: "/admin/devices", icon: Boxes, value: counts.devices },
    { label: "Cupons", href: "/admin/coupons", icon: Tag, value: counts.coupons },
  ];
  if (isSuperadmin) {
    tiles.push(
      { label: "Empresas", href: "/admin/companies", icon: Building2, value: counts.companies },
      { label: "Usuários", href: "/admin/users", icon: Users, value: counts.users },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user?.email.split("@")[0]}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {isSuperadmin
            ? "Você está vendo todos os dados do sistema."
            : `Você gerencia a empresa #${user?.company_id ?? "—"}.`}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="transition-colors hover:bg-[var(--accent)]/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  {tile.label}
                </CardTitle>
                <tile.icon className="size-4 text-[var(--muted-foreground)]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {tile.value === null ? "—" : tile.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
