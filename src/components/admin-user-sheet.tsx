import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminUser,
  grantAccess,
  revokeAccess,
  sendPasswordReset,
  setAccountStatus,
  updateAdminUser,
  type AccountStatus,
} from "@/lib/users-admin.functions";
import {
  formatWhatsapp,
  maskWhatsapp,
  normalizeWhatsapp,
  postTrialMessage,
  waLink,
} from "@/lib/whatsapp";

const dt = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const actionLabels: Record<string, string> = {
  user_updated: "Dados atualizados",
  user_enabled: "Conta ativada",
  user_disabled: "Conta desativada",
  user_blocked: "Usuário bloqueado",
  user_deleted: "Usuário excluído",
  access_granted: "Acesso concedido",
  access_revoked: "Acesso revogado",
  password_reset_requested: "Redefinição de senha enviada",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export function AdminUserSheet({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getAdminUser);
  const saveProfile = useServerFn(updateAdminUser);
  const changeStatus = useServerFn(setAccountStatus);
  const grant = useServerFn(grantAccess);
  const revoke = useServerFn(revokeAccess);
  const resetPassword = useServerFn(sendPasswordReset);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchDetail({ data: { userId: userId! } }),
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    professionalName: "",
    city: "",
    state: "",
    bio: "",
    whatsapp: "",
  });
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<"trial" | "founder">("founder");

  useEffect(() => {
    if (!data) return;
    setForm({
      firstName: data.user.firstName ?? "",
      lastName: data.user.lastName ?? "",
      professionalName: data.user.professionalName ?? "",
      city: data.user.city ?? "",
      state: data.user.state ?? "",
      bio: data.user.bio ?? "",
      whatsapp: formatWhatsapp(data.user.whatsapp) ?? "",
    });
    setReason("");
  }, [data]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
  }

  const save = useMutation({
    mutationFn: () =>
      saveProfile({
        data: { userId: userId!, ...form, whatsapp: normalizeWhatsapp(form.whatsapp) },
      }),
    onSuccess: () => {
      toast.success("Dados do usuário atualizados.");
      refresh();
    },
    onError: () => toast.error("Não foi possível salvar as alterações."),
  });

  const status = useMutation({
    mutationFn: (next: AccountStatus) =>
      changeStatus({ data: { userId: userId!, status: next, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Situação da conta atualizada.");
      refresh();
    },
    onError: () => toast.error("Não foi possível alterar a situação da conta."),
  });

  const grantMutation = useMutation({
    mutationFn: () => grant({ data: { userId: userId!, plan, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Acesso concedido.");
      refresh();
    },
    onError: () => toast.error("Não foi possível conceder o acesso."),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revoke({ data: { userId: userId!, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Acesso revogado.");
      refresh();
    },
    onError: () => toast.error("Não foi possível revogar o acesso."),
  });

  const reset = useMutation({
    mutationFn: () =>
      resetPassword({
        data: { userId: userId!, redirectTo: `${window.location.origin}/reset-password` },
      }),
    onSuccess: () => toast.success("E-mail de redefinição de senha enviado."),
    onError: () => toast.error("Não foi possível enviar a redefinição."),
  });

  const user = data?.user;

  return (
    <Sheet open={Boolean(userId)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Usuário</SheetTitle>
        </SheetHeader>

        {isLoading || !user ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5 p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarImage src={user.photoUrl ?? undefined} alt={user.email} />
                <AvatarFallback>{user.email.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
                </div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>

            <Tabs defaultValue="detalhes">
              <TabsList>
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="editar">Editar</TabsTrigger>
                <TabsTrigger value="acoes">Administração</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="space-y-5 pt-4">
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Conta
                  </h3>
                  <Row
                    label="Nome"
                    value={[user.firstName, user.lastName].filter(Boolean).join(" ")}
                  />
                  <Row label="Nome profissional" value={user.professionalName} />
                  <Row label="E-mail" value={user.email} />
                  <Row label="WhatsApp" value={formatWhatsapp(user.whatsapp)} />
                  <Row label="Cidade" value={user.city} />
                  <Row label="Estado" value={user.state} />
                  <Row label="Cadastro" value={dt(user.createdAt)} />
                  <Row label="Status da conta" value={user.accountStatus} />
                  <Row label="ID" value={<code className="text-[11px]">{user.id}</code>} />
                  {user.blockedReason && (
                    <Row label="Motivo do bloqueio" value={user.blockedReason} />
                  )}
                </section>

                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Acesso
                  </h3>
                  <Row label="Plano atual" value={user.plan} />
                  <Row label="Tipo de acesso" value={user.accessType} />
                  <Row label="Status do acesso" value={user.accessStatus} />
                  <Row label="Fonte do acesso" value={user.accessSource} />
                  <Row label="Início do trial" value={dt(user.trialStartedAt)} />
                  <Row label="Expiração" value={user.lifetime ? "—" : dt(user.trialEndsAt)} />
                  <Row label="Acesso vitalício (fundador)" value={user.lifetime ? "Sim" : "Não"} />
                </section>

                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Acompanhamento
                  </h3>
                  <Row label="Último acesso" value={dt(user.lastSignInAt)} />
                  <Row
                    label="Aceita contato por WhatsApp"
                    value={user.feedbackOptIn ? "Sim" : "Não"}
                  />
                  <Row
                    label="Interesse na comunidade"
                    value={user.communityInterest ? "Sim" : "Não"}
                  />
                  <Row
                    label="Contato pós-teste"
                    value={user.postTrialContactedAt ? dt(user.postTrialContactedAt) : "Pendente"}
                  />
                  {user.whatsapp && (
                    <a
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
                      href={waLink(user.whatsapp, postTrialMessage(user.firstName)) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir conversa no WhatsApp
                    </a>
                  )}
                </section>

                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Compras
                  </h3>
                  {data.purchases.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">Nenhuma compra registrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.purchases.map((p) => (
                        <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">{p.event}</span>
                            <span className="text-xs text-muted-foreground">{dt(p.createdAt)}</span>
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            <div>Product ID: {p.productId ?? "—"}</div>
                            <div>Offer ID: {p.offerId ?? "—"}</div>
                            <div>Transaction ID: {p.transactionId ?? "—"}</div>
                            <div>
                              Status: {p.status ?? "—"} · {p.result}
                            </div>
                            <div>Comprador: {p.buyerEmail ?? "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="editar" className="space-y-3 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sobrenome</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome profissional</Label>
                  <Input
                    value={form.professionalName}
                    onChange={(e) => setForm({ ...form, professionalName: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input
                    type="tel"
                    placeholder="(47) 99999-9999"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: maskWhatsapp(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bio</Label>
                  <Textarea
                    rows={3}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A senha nunca é exibida nem alterada aqui. Use “Enviar redefinição de senha”.
                </p>
                <Button disabled={save.isPending} onClick={() => save.mutate()}>
                  Salvar alterações
                </Button>
              </TabsContent>

              <TabsContent value="acoes" className="space-y-4 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Administração
                </h3>
                <div className="space-y-1.5">
                  <Label>Motivo (opcional)</Label>
                  <Input
                    value={reason}
                    placeholder="Ex.: Concedido como cortesia"
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Conta
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.accountStatus !== "active" && (
                      <Button size="sm" onClick={() => status.mutate("active")}>
                        Ativar conta
                      </Button>
                    )}
                    {user.accountStatus === "active" && (
                      <Button size="sm" variant="outline" onClick={() => status.mutate("inactive")}>
                        Desativar conta
                      </Button>
                    )}
                    {user.accountStatus !== "blocked" && (
                      <Button size="sm" variant="outline" onClick={() => status.mutate("blocked")}>
                        Bloquear usuário
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => reset.mutate()}>
                      Enviar redefinição de senha
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Acesso
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={plan} onValueChange={(v) => setPlan(v as "trial" | "founder")}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial (7 dias)</SelectItem>
                        <SelectItem value="founder">Fundador (vitalício)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => grantMutation.mutate()}>
                      Conceder acesso
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm("Revogar o acesso deste usuário?")) {
                          revokeMutation.mutate();
                        }
                      }}
                    >
                      Revogar acesso
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-destructive/40 p-3">
                  <div className="text-xs font-semibold uppercase tracking-widest text-destructive">
                    Zona de risco
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A exclusão é lógica: a conta é removida do sistema, mas os dados históricos são
                    preservados.
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={user.accountStatus === "deleted"}
                    onClick={() => {
                      if (!window.confirm("Excluir este usuário?")) return;
                      if (!window.confirm("Esta ação remove a conta do sistema. Confirmar?"))
                        return;
                      status.mutate("deleted");
                    }}
                  >
                    Excluir usuário
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="historico" className="space-y-2 pt-4">
                <div className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>Conta criada</span>
                    <span className="text-xs text-muted-foreground">{dt(user.createdAt)}</span>
                  </div>
                  {user.trialStartedAt && (
                    <div className="mt-2 flex justify-between gap-3">
                      <span>Trial iniciado</span>
                      <span className="text-xs text-muted-foreground">
                        {dt(user.trialStartedAt)}
                      </span>
                    </div>
                  )}
                  {user.activatedAt && (
                    <div className="mt-2 flex justify-between gap-3">
                      <span>Acesso ativado</span>
                      <span className="text-xs text-muted-foreground">{dt(user.activatedAt)}</span>
                    </div>
                  )}
                </div>

                {data.purchases.map((p) => (
                  <div key={`h-${p.id}`} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>
                        {p.provider === "hotmart" ? "Hotmart (histórico)" : "Kiwify"} · {p.event}
                      </span>
                      <span className="text-xs text-muted-foreground">{dt(p.createdAt)}</span>
                    </div>
                  </div>
                ))}

                {data.history.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{actionLabels[h.action] ?? h.action}</span>
                      <span className="text-xs text-muted-foreground">{dt(h.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {h.adminEmail ?? "—"}
                      {h.reason ? ` · ${h.reason}` : ""}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
