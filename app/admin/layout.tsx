"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, KeyRound, LayoutDashboard, LogOut, Settings, Tag, Users, Boxes } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChangePasswordDialog } from "@/components/admin/change-password-dialog";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superadminOnly?: boolean;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/devices", label: "Máquinas", icon: Boxes },
  { href: "/admin/coupons", label: "Cupons", icon: Tag },
  { href: "/admin/companies", label: "Empresas", icon: Building2, superadminOnly: true },
  { href: "/admin/users", label: "Usuários", icon: Users, superadminOnly: true },
  { href: "/admin/settings", label: "Configurações", icon: Settings, adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, isSuperadmin } = useAuth();
  const [changePwOpen, setChangePwOpen] = useState(false);

  const isLoginRoute = pathname === "/admin/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginRoute) router.replace("/admin/login");
  }, [loading, user, isLoginRoute, router]);

  if (isLoginRoute) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[var(--muted-foreground)]">
        Carregando...
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.superadminOnly) return isSuperadmin;
    if (item.adminOnly) return !isSuperadmin;
    return true;
  });

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r bg-[var(--card)] md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <span className="font-semibold">Chazz Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                )}
              >
                <item.icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t p-3 text-xs text-[var(--muted-foreground)]">
          <p className="line-clamp-1 font-medium text-[var(--foreground)]">{user.email}</p>
          <p>{isSuperadmin ? "Superadmin" : `Admin · company #${user.company_id ?? "—"}`}</p>
          <Button variant="ghost" size="sm" onClick={() => setChangePwOpen(true)} className="mt-2 w-full justify-start gap-2">
            <KeyRound className="size-4" /> Alterar senha
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start gap-2">
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
        <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      </aside>

      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <Link href="/admin" className="font-semibold">Chazz Admin</Link>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b px-4 py-2 md:hidden">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs whitespace-nowrap",
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
