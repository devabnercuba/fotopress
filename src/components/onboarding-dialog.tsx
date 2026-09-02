import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, useProfileMutation } from "@/lib/profile";

/**
 * Boas-vindas curtas no primeiro acesso. Nunca bloqueia o app: o usuário pode
 * configurar agora ou explorar por conta própria e continuar depois pelo
 * checklist do Dashboard / Primeiros passos.
 */
export function OnboardingDialog() {
  const { data: profile } = useProfile();
  const save = useProfileMutation();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");

  const open = !!profile && !profile.onboarded && !closed;
  if (!profile) return null;

  function markSeen(extra: Record<string, unknown> = {}, message?: string) {
    if (!profile) return;
    setClosed(true);
    save.mutate(
      { id: profile.id, onboarded: true, ...extra },
      {
        onSuccess: () => message && toast.success(message),
        onError: () => toast.error("Não foi possível salvar seus dados."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && markSeen()}>
      <DialogContent className="sm:max-w-md">
        {step === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Bem-vindo ao FotoPress 👋</DialogTitle>
              <DialogDescription>
                Vamos preparar seu espaço para organizar suas próximas coberturas.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Leva apenas alguns minutos. Você pode fazer tudo agora ou continuar depois — o
              checklist fica no Dashboard e em “Primeiros passos”.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => markSeen()}>
                Explorar por conta própria
              </Button>
              <Button onClick={() => setStep(1)}>Começar configuração</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Seus dados básicos</DialogTitle>
              <DialogDescription>
                Você pode completar o restante depois em Configurações.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ob-first">Nome</Label>
                <Input
                  id="ob-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={profile.first_name ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-last">Sobrenome</Label>
                <Input
                  id="ob-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={profile.last_name ?? ""}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ob-city">Cidade</Label>
                <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => markSeen()}>
                Pular por enquanto
              </Button>
              <Button
                disabled={save.isPending}
                onClick={() =>
                  markSeen(
                    {
                      first_name: firstName.trim() || profile.first_name,
                      last_name: lastName.trim() || profile.last_name,
                      city: city.trim() || profile.city,
                    },
                    "Tudo pronto! Bom trabalho.",
                  )
                }
              >
                {save.isPending ? "Salvando…" : "Começar a usar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
