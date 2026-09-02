import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { TURNSTILE_SITE_KEY, TurnstileWidget } from "@/components/turnstile-widget";
import { isValidWhatsapp, maskWhatsapp, normalizeWhatsapp } from "@/lib/whatsapp";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => {
    const mode = search.mode;
    return {
      mode: mode === "signup" || mode === "forgot" ? mode : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Entrar — FotoPress" },
      {
        name: "description",
        content: "Acesse o FotoPress para organizar jogos, credenciamentos e coberturas.",
      },
      { property: "og:title", content: "Entrar — FotoPress" },
      {
        property: "og:description",
        content: "Acesse sua conta do FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<Mode>((initialMode as Mode) ?? "signin");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [feedbackOptIn, setFeedbackOptIn] = useState(false);
  const [communityInterest, setCommunityInterest] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const captchaRequired = !!TURNSTILE_SITE_KEY;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      if (mode === "signup") {
        if (password !== confirm) {
          toast.error("As senhas não conferem.");
          return;
        }
        if (!isValidWhatsapp(whatsapp)) {
          toast.error("Informe um WhatsApp válido com DDD.");
          return;
        }
        if (captchaRequired && !captchaToken) {
          toast.error("Conclua a verificação de segurança.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: name.trim(),
              whatsapp: normalizeWhatsapp(whatsapp),
              feedback_whatsapp_opt_in: feedbackOptIn,
              founder_community_interest: communityInterest,
            },
            ...(captchaToken ? { captchaToken } : {}),
          },
        });
        if (error) {
          setCaptchaToken(null);
          setCaptchaKey((k) => k + 1);
          throw error;
        }
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          setPendingEmail(email);
          setCooldown(60);
        }
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos as instruções de recuperação para o seu e-mail.");
      setMode("signin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, { title: string; description: string; action: string }> = {
    signin: {
      title: "Entrar",
      description: "Acesse sua agenda de coberturas esportivas.",
      action: "Entrar",
    },
    signup: {
      title: "Criar conta",
      description: "Comece a organizar seus jogos e credenciamentos.",
      action: "Criar conta",
    },
    forgot: {
      title: "Recuperar senha",
      description: "Informe seu e-mail para receber as instruções.",
      action: "Enviar instruções",
    },
  };
  const copy = titles[mode];

  async function resend() {
    if (!pendingEmail || cooldown > 0) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("E-mail de confirmação reenviado.");
      setCooldown(60);
    }
  }

  if (pendingEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Camera className="size-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">FotoPress</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Verifique seu e-mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong>{pendingEmail}</strong>. Confirme seu
            endereço para ativar sua conta.
          </p>
          <div className="mt-6 space-y-2">
            <Button variant="outline" className="w-full" disabled={cooldown > 0} onClick={resend}>
              {cooldown > 0 ? `Reenviar e-mail (${cooldown}s)` : "Reenviar e-mail"}
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                setPendingEmail(null);
                setMode("signin");
                setPassword("");
                setConfirm("");
              }}
            >
              Voltar para entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>

        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Camera className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">FotoPress</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name">Nome</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email">E-mail</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-whatsapp">WhatsApp</Label>
              <Input
                id="auth-whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(47) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Usaremos seu WhatsApp para suporte e para acompanhar sua experiência com o
                FotoPress.
              </p>
            </div>
          )}

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Senha</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-confirm">Confirmar senha</Label>
              <Input
                id="auth-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-2.5 rounded-lg border border-border bg-surface p-3">
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={feedbackOptIn}
                  onCheckedChange={(v) => setFeedbackOptIn(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Aceito receber contato pelo WhatsApp para compartilhar minha experiência e ajudar
                  a melhorar o FotoPress.
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={communityInterest}
                  onCheckedChange={(v) => setCommunityInterest(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Tenho interesse em participar futuramente da comunidade de Fundadores do FotoPress
                  no WhatsApp.
                </span>
              </label>
            </div>
          )}

          {mode === "signup" && captchaRequired && (
            <TurnstileWidget resetKey={captchaKey} onToken={setCaptchaToken} />
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (mode === "signup" && captchaRequired && !captchaToken)}
          >
            {loading ? "Aguarde…" : copy.action}
          </Button>
          {mode === "signup" && captchaRequired && !captchaToken && (
            <p className="text-center text-xs text-muted-foreground">
              Conclua a verificação de segurança para criar sua conta.
            </p>
          )}
        </form>

        <div className="mt-5 space-y-2 text-center text-xs text-muted-foreground">
          {mode === "signin" && (
            <>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setMode("forgot")}
              >
                Esqueci minha senha
              </button>
              <div>
                Não tem conta?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Criar conta
                </button>
              </div>
            </>
          )}
          {mode !== "signin" && (
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => setMode("signin")}
            >
              Já tenho uma conta — entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
