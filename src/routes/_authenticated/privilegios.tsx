import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, MoreVertical, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminUserSheet } from "@/components/admin-user-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireMasterAdmin } from "@/lib/admin";
import {
  grantAccess,
  listAdminUsers,
  revokeAccess,
  sendPasswordReset,
  setAccountStatus,
  setPostTrialContacted,
  type AccountStatus,
  type AdminUserRow,
} from "@/lib/users-admin.functions";
import { formatWhatsapp, postTrialMessage, waLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/privilegios")({
  beforeLoad: requireMasterAdmin,
  head: () => ({
    meta: [
      { title: "Controle de Usuários — FotoPress" },
      {
        name: "description",
        content:
          "Painel administrativo dos clientes do FotoPress: contas, planos, acessos e auditoria.",
      },
      { property: "og:title", content: "Controle de Usuários — FotoPress" },
      {
        property: "og:description",
        content: "Gerencie contas, planos, bloqueios e acessos dos clientes do FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersAdminPage,
});

const ALL = "todos";

const statusLabel: Record<AccountStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
  deleted: "Excluído",
};

const statusTone: Record<AccountStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  inactive: "bg-muted text-muted-foreground",
  blocked: "bg-destructive/10 text-destructive",
  deleted: "bg-destructive/10 text-destructive",
};

const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—");

function planLabel(row: AdminUserRow) {
  if (row.accessType === "founder") return "Fundador";
  if (row.accessType === "trial") return "Trial";
  return row.plan ?? "—";
}

function accessLabel(row: AdminUserRow) {
  if (row.lifetime) return "Vitalício";
  switch (row.accessStatus) {
    case "active":
      return "Ativo";
    case "trial":
      return "Em teste";
    case "expired":
      return "Expirado";
    case "cancelled":
      return "Cancelado";
    default:
      return "—";
  }
}

function trialLabel(row: AdminUserRow) {
  if (row.lifetime) return "Vitalício";
  if (row.accessType !== "trial") return "—";
  return date(row.trialEndsAt);
}

/** Teste encerrado: trial expirado e sem acesso pago vigente. */
function trialEnded(row: AdminUserRow) {
  if (row.lifetime || row.accessStatus === "active") return false;
  if (row.accessStatus === "expired") return true;
  return Boolean(
    row.accessType === "trial" && row.trialEndsAt && new Date(row.trialEndsAt) < new Date(),
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold sm:text-2xl">{value}</div>
    </div>
  );
}

function UsersAdminPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const changeStatus = useServerFn(setAccountStatus);
  const grant = useServerFn(grantAccess);
  const revoke = useServerFn(revokeAccess);
  const resetPassword = useServerFn(sendPasswordReset);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState(ALL);
  const [plan, setPlan] = useState(ALL);
  const [access, setAccess] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [contact, setContact] = useState(ALL);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; status: AccountStatus }) => changeStatus({ data: input }),
    onSuccess: () => {
      toast.success("Situação da conta atualizada.");
      refresh();
    },
    onError: () => toast.error("Não foi possível alterar a situação da conta."),
  });

  const grantMutation = useMutation({
    mutationFn: (input: { userId: string; plan: "trial" | "founder" }) => grant({ data: input }),
    onSuccess: () => {
      toast.success("Acesso concedido.");
      refresh();
    },
    onError: () => toast.error("Não foi possível conceder o acesso."),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => revoke({ data: { userId } }),
    onSuccess: () => {
      toast.success("Acesso revogado.");
      refresh();
    },
    onError: () => toast.error("Não foi possível revogar o acesso."),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: string) =>
      resetPassword({ data: { userId, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: () => toast.success("E-mail de redefinição enviado."),
    onError: () => toast.error("Não foi possível enviar a redefinição."),
  });

  const markContacted = useServerFn(setPostTrialContacted);
  const contactMutation = useMutation({
    mutationFn: (input: { userId: string; contacted: boolean }) => markContacted({ data: input }),
    onSuccess: () => {
      toast.success("Contato pós-teste atualizado.");
      refresh();
    },
    onError: () => toast.error("Não foi possível atualizar o contato."),
  });

  const openWhatsapp = (row: AdminUserRow) => {
    const link = waLink(row.whatsapp, postTrialMessage(row.firstName));
    if (!link) {
      toast.error("Este usuário não informou WhatsApp.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (account !== ALL && r.accountStatus !== account) return false;
      if (plan !== ALL && r.accessType !== plan) return false;
      if (access !== ALL && r.accessStatus !== access) return false;
      if (source !== ALL && (r.accessSource ?? "") !== source) return false;
      if (contact === "trial_ended" && !trialEnded(r)) return false;
      if (contact === "to_contact" && (!trialEnded(r) || r.postTrialContactedAt)) return false;
      if (contact === "contacted" && !r.postTrialContactedAt) return false;
      if (contact === "opt_in" && !r.feedbackOptIn) return false;
      if (contact === "community" && !r.communityInterest) return false;
      if (contact === "no_whatsapp" && r.whatsapp) return false;
      if (
        term &&
        ![r.email, r.firstName, r.lastName, r.professionalName]
          .filter(Boolean)
          .every((v) => !String(v).toLowerCase().includes(term))
      )
        return false;
      return true;
    });
  }, [data, search, account, plan, access, source, contact]);

  const stats = data?.stats;
  const secondary = useMemo(() => {
    const all = data?.rows ?? [];
    return {
      trialsEnded: all.filter(trialEnded).length,
      pendingPurchases: stats?.pendingPurchases ?? 0,
      blocked: stats?.blocked ?? 0,
    };
  }, [data, stats]);

  const renderActionsMenu = (row: AdminUserRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Ações">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setSelected(row.id)}>Ver / editar</DropdownMenuItem>
        {row.whatsapp && (
          <DropdownMenuItem onClick={() => openWhatsapp(row)}>Abrir WhatsApp</DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            contactMutation.mutate({
              userId: row.id,
              contacted: !row.postTrialContactedAt,
            })
          }
        >
          {row.postTrialContactedAt ? "Desmarcar contato pós-teste" : "Marcar como contatado"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.accountStatus !== "active" && (
          <DropdownMenuItem
            onClick={() => statusMutation.mutate({ userId: row.id, status: "active" })}
          >
            Ativar
          </DropdownMenuItem>
        )}
        {row.accountStatus === "active" && (
          <DropdownMenuItem
            onClick={() => statusMutation.mutate({ userId: row.id, status: "inactive" })}
          >
            Desativar
          </DropdownMenuItem>
        )}
        {row.accountStatus !== "blocked" && (
          <DropdownMenuItem
            onClick={() => statusMutation.mutate({ userId: row.id, status: "blocked" })}
          >
            Bloquear
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => grantMutation.mutate({ userId: row.id, plan: "founder" })}>
          Conceder acesso fundador
        </DropdownMenuItem>
        {row.accessStatus !== "cancelled" && (
          <DropdownMenuItem
            onClick={() => {
              if (window.confirm("Revogar o acesso deste usuário?")) {
                revokeMutation.mutate(row.id);
              }
            }}
          >
            Revogar acesso
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => resetMutation.mutate(row.id)}>
          Enviar redefinição de senha
        </DropdownMenuItem>
        {row.accountStatus !== "deleted" && !row.isMasterAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (!window.confirm("Excluir este usuário?")) return;
                if (!window.confirm("Esta ação remove a conta do sistema. Confirmar?")) return;
                statusMutation.mutate({ userId: row.id, status: "deleted" });
              }}
            >
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controle de Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie contas, acessos e acompanhamento dos usuários do FotoPress.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Usuários" value={stats?.total ?? 0} />
          <Kpi label="Ativos" value={stats?.active ?? 0} />
          <Kpi label="Em Trial" value={stats?.trials ?? 0} />
          <Kpi label="Fundadores" value={stats?.founders ?? 0} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{secondary.blocked} bloqueados</Badge>
          <Badge variant="secondary">{secondary.pendingPurchases} compras pendentes</Badge>
          <Badge variant="secondary">{secondary.trialsEnded} trials encerrados</Badge>
        </div>
      </section>

      <section className="space-y-2">
        <Input
          placeholder="Buscar por nome, e-mail ou nome profissional"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as contas</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
              <SelectItem value="deleted">Excluído</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger>
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os planos</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="founder">Fundador</SelectItem>
            </SelectContent>
          </Select>
          <Select value={access} onValueChange={setAccess}>
            <SelectTrigger>
              <SelectValue placeholder="Acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os acessos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trial">Em teste</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={contact} onValueChange={setContact}>
            <SelectTrigger>
              <SelectValue placeholder="Acompanhamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todo acompanhamento</SelectItem>
              <SelectItem value="trial_ended">Teste encerrado</SelectItem>
              <SelectItem value="to_contact">Teste encerrado sem contato</SelectItem>
              <SelectItem value="contacted">Já contatado</SelectItem>
              <SelectItem value="opt_in">Aceita contato por WhatsApp</SelectItem>
              <SelectItem value="community">Interesse na comunidade</SelectItem>
              <SelectItem value="no_whatsapp">Sem WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as fontes</SelectItem>
              <SelectItem value="signup">Trial</SelectItem>
              <SelectItem value="kiwify">Kiwify</SelectItem>
              <SelectItem value="hotmart">Hotmart (histórico)</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar os usuários.
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum usuário encontrado com estes filtros.
        </div>
      ) : (
        <>
          {/* Desktop: tabela administrativa */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Usuário</th>
                  <th className="px-4 py-2 font-medium">Acesso</th>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Trial</th>
                  <th className="px-4 py-2 font-medium">WhatsApp</th>
                  <th className="px-4 py-2 font-medium">Cadastro</th>
                  <th className="px-4 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-border hover:bg-muted/40"
                    onClick={() => setSelected(row.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={row.photoUrl ?? undefined} alt={row.email} />
                          <AvatarFallback>{row.email.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 truncate font-medium">
                            {[row.firstName, row.lastName].filter(Boolean).join(" ") ||
                              row.professionalName ||
                              "Sem nome"}
                            {row.isMasterAdmin && <ShieldCheck className="size-3.5 text-primary" />}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-[11px] font-medium ${statusTone[row.accountStatus]}`}
                      >
                        {statusLabel[row.accountStatus]}
                      </span>
                      <div className="mt-1 text-xs text-muted-foreground">{accessLabel(row)}</div>
                    </td>
                    <td className="px-4 py-3">{planLabel(row)}</td>
                    <td className="px-4 py-3">{trialLabel(row)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {row.whatsapp ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openWhatsapp(row)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            title="Abrir conversa no WhatsApp"
                          >
                            <MessageCircle className="size-3.5 text-emerald-600" />
                            {formatWhatsapp(row.whatsapp)}
                          </button>
                          {row.postTrialContactedAt && (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                              contatado
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{date(row.createdAt)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {renderActionsMenu(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards empilhados */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className="cursor-pointer rounded-xl border border-border bg-card p-3"
                onClick={() => setSelected(row.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={row.photoUrl ?? undefined} alt={row.email} />
                      <AvatarFallback>{row.email.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm font-medium">
                        {[row.firstName, row.lastName].filter(Boolean).join(" ") ||
                          row.professionalName ||
                          "Sem nome"}
                        {row.isMasterAdmin && <ShieldCheck className="size-3.5 text-primary" />}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{row.email}</div>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>{renderActionsMenu(row)}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Acesso</div>
                    <span
                      className={`mt-0.5 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${statusTone[row.accountStatus]}`}
                    >
                      {statusLabel[row.accountStatus]}
                    </span>
                    <div className="mt-1 text-muted-foreground">{accessLabel(row)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Plano</div>
                    <div className="mt-0.5 font-medium">{planLabel(row)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Trial</div>
                    <div className="mt-0.5">{trialLabel(row)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cadastro</div>
                    <div className="mt-0.5">{date(row.createdAt)}</div>
                  </div>
                </div>
                {row.whatsapp && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openWhatsapp(row)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      <MessageCircle className="size-3.5 text-emerald-600" />
                      {formatWhatsapp(row.whatsapp)}
                    </button>
                    {row.postTrialContactedAt && (
                      <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                        contatado
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <AdminUserSheet userId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
