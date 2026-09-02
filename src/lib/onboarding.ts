import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, Download, Star, Trophy, UserRound, Users } from "lucide-react";

import { useAthletes } from "./athletes";
import { useCoverages } from "./coverages";
import { useDataSources } from "./data-sources";
import { useAuthUser, useProfile } from "./profile";
import { useCompetitions, useMatches } from "./queries";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  action: string;
  to: string;
  icon: LucideIcon;
  done: boolean;
};

const KEY = (userId: string) => `fotopress:onboarding:${userId}`;

type Stored = { dismissed?: boolean; welcomeSeen?: boolean };

function read(userId?: string | null): Stored {
  if (!userId || typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY(userId)) ?? "{}") as Stored;
  } catch {
    return {};
  }
}

function write(userId: string, patch: Stored) {
  const next = { ...read(userId), ...patch };
  window.localStorage.setItem(KEY(userId), JSON.stringify(next));
  window.dispatchEvent(new Event("fotopress:onboarding"));
}

/**
 * Progresso do onboarding calculado sempre pelos dados reais do usuário
 * (nada de flags manuais). O único estado persistido é "ocultar o card",
 * guardado por user_id no navegador.
 */
export function useOnboarding() {
  const { data: user } = useAuthUser();
  const { data: profile } = useProfile();
  const { data: competitions = [] } = useCompetitions();
  const { data: sources = [] } = useDataSources();
  const { data: matches = [] } = useMatches();
  const { data: coverages = [] } = useCoverages();
  const { data: athletes = [] } = useAthletes();

  const [stored, setStored] = useState<Stored>({});
  useEffect(() => {
    const sync = () => setStored(read(user?.id));
    sync();
    window.addEventListener("fotopress:onboarding", sync);
    return () => window.removeEventListener("fotopress:onboarding", sync);
  }, [user?.id]);

  const profileDone = !!(profile?.first_name?.trim() && profile?.city?.trim());

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Complete seu perfil",
      description: "Seu nome e cidade ajudam a organizar suas coberturas.",
      action: "Abrir configurações",
      to: "/configuracoes",
      icon: UserRound,
      done: profileDone,
    },
    {
      id: "competition",
      title: "Crie seu primeiro campeonato",
      description: "Os jogos ficam vinculados às competições que você acompanha.",
      action: "Gerenciar campeonatos",
      to: "/campeonatos",
      icon: Trophy,
      done: competitions.length > 0,
    },
    {
      id: "source",
      title: "Adicione uma fonte de jogos",
      description: "CBF, FCF, LNF ou o modelo oficial em PDF/XLSX.",
      action: "Adicionar fonte",
      to: "/fontes",
      icon: Download,
      done: sources.length > 0,
    },
    {
      id: "matches",
      title: "Adicione seus primeiros jogos",
      description: "Importe de uma fonte ou cadastre uma partida manualmente.",
      action: "Ver jogos",
      to: "/jogos",
      icon: ClipboardList,
      done: matches.length > 0,
    },
    {
      id: "coverage",
      title: "Adicione uma cobertura à Minha Agenda",
      description: "Solicite o credenciamento de um jogo e acompanhe a aprovação.",
      action: "Ver credenciamentos",
      to: "/credenciamento",
      icon: Star,
      done: coverages.length > 0,
    },
    {
      id: "athlete",
      title: "Cadastre seu primeiro Atleta/Cliente",
      description: "Comece sua base de contatos, prospects e clientes.",
      action: "Gerenciar contatos",
      to: "/atletas",
      icon: Users,
      done: athletes.length > 0,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  const dismiss = useCallback(() => {
    if (user?.id) write(user.id, { dismissed: true });
  }, [user?.id]);

  const reopen = useCallback(() => {
    if (user?.id) write(user.id, { dismissed: false });
  }, [user?.id]);

  const markWelcomeSeen = useCallback(() => {
    if (user?.id) write(user.id, { welcomeSeen: true });
  }, [user?.id]);

  return {
    steps,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    allDone,
    dismissed: !!stored.dismissed,
    welcomeSeen: !!stored.welcomeSeen,
    showCard: !stored.dismissed && !allDone,
    dismiss,
    reopen,
    markWelcomeSeen,
  };
}
