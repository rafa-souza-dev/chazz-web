"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdminUser, Company, Role } from "@/lib/types";
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

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; user: AdminUser }
  | { kind: "delete"; user: AdminUser };

export default function AdminUsersPage() {
  const router = useRouter();
  const { loading: authLoading, isSuperadmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperadmin) {
      router.replace("/admin");
      return;
    }
    Promise.all([
      api.get<AdminUser[]>("/users"),
      api.get<Company[]>("/companies"),
      api.get<Role[]>("/roles"),
    ])
      .then(([u, c, r]) => {
        setUsers(u.data);
        setCompanies(c.data);
        setRoles(r.data);
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Erro ao carregar usuários")))
      .finally(() => setLoading(false));
  }, [authLoading, isSuperadmin, router]);

  const closeDialog = () => setDialog({ kind: "closed" });

  async function handleCreate(payload: {
    email: string;
    password: string;
    company_id: number | null;
    role_slugs: string[];
  }) {
    try {
      const res = await api.post<AdminUser>("/users", payload);
      setUsers((current) => [...current, res.data]);
      toast.success("Usuário criado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao criar"));
    }
  }

  async function handleEdit(
    user: AdminUser,
    payload: {
      email: string;
      password?: string;
      company_id: number | null;
      role_slugs: string[];
    },
  ) {
    try {
      const res = await api.put<AdminUser>(`/users/${user.id}`, payload);
      setUsers((current) => current.map((u) => (u.id === user.id ? res.data : u)));
      toast.success("Usuário atualizado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao atualizar"));
    }
  }

  async function handleDelete(user: AdminUser) {
    try {
      await api.delete(`/users/${user.id}`);
      setUsers((current) => current.filter((u) => u.id !== user.id));
      toast.success("Usuário removido");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Falha ao remover"));
    }
  }

  if (!isSuperadmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {users.length} {users.length === 1 ? "usuário" : "usuários"} no sistema.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })} className="gap-2">
          <Plus className="size-4" /> Novo usuário
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--muted-foreground)]">
            Carregando usuários...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const company = companies.find((c) => c.id === user.company_id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell className="text-xs">
                        {company?.name ?? (user.company_id ? `#${user.company_id}` : "—")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r) => (
                            <Badge key={r} variant="secondary">{r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "edit", user })} className="gap-2">
                          <Pencil className="size-3" /> Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDialog({ kind: "delete", user })} className="gap-2">
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
        <UserFormDialog
          mode="create"
          companies={companies}
          roles={roles}
          onClose={closeDialog}
          onSave={async (payload) => {
            await handleCreate(payload as Required<typeof payload>);
            closeDialog();
          }}
        />
      ) : null}

      {dialog.kind === "edit" ? (
        <UserFormDialog
          mode="edit"
          user={dialog.user}
          companies={companies}
          roles={roles}
          onClose={closeDialog}
          onSave={async (payload) => {
            await handleEdit(dialog.user, payload);
            closeDialog();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={dialog.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Excluir usuário"
        description={dialog.kind === "delete" ? `Excluir ${dialog.user.email}?` : undefined}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (dialog.kind === "delete") await handleDelete(dialog.user);
        }}
      />
    </div>
  );
}

type UserFormPayload = {
  email: string;
  password?: string;
  company_id: number | null;
  role_slugs: string[];
};

function UserFormDialog({
  mode,
  user,
  companies,
  roles,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  user?: AdminUser;
  companies: Company[];
  roles: Role[];
  onClose: () => void;
  onSave: (payload: UserFormPayload) => Promise<void>;
}) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<string>(user?.company_id ? String(user.company_id) : "");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set(user?.roles ?? ["admin"]),
  );
  const [submitting, setSubmitting] = useState(false);

  function toggleRole(slug: string) {
    setSelectedRoles((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo usuário" : "Editar usuário"}</DialogTitle>
          <DialogDescription>
            Apenas superadmins podem criar e gerenciar usuários.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pwd">Senha {mode === "edit" ? "(deixe em branco para manter)" : ""}</Label>
            <Input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
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
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const active = selectedRoles.has(role.slug);
                return (
                  <Button
                    key={role.slug}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role.slug)}
                  >
                    {role.name}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={
              submitting || !email.trim() || (mode === "create" && password.length < 8) || selectedRoles.size === 0
            }
            onClick={async () => {
              if (mode === "create" && password.length < 8) {
                toast.error("Senha precisa ter ao menos 8 caracteres");
                return;
              }
              setSubmitting(true);
              try {
                const payload: UserFormPayload = {
                  email: email.trim(),
                  company_id: companyId ? Number(companyId) : null,
                  role_slugs: Array.from(selectedRoles),
                };
                if (password) payload.password = password;
                await onSave(payload);
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
