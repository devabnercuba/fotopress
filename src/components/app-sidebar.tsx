import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Download,
  GraduationCap,
  History,
  Home,
  Lightbulb,
  Megaphone,
  Newspaper,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Menu,
  Users,
  UsersRound,
  Volleyball,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import { QuickCreate } from "@/components/quick-create";
import { UserMenu } from "@/components/user-menu";
import { useIsMasterAdmin } from "@/lib/admin";
import { useUnreadUpdatesCount } from "@/lib/product-updates";
import { openNewsUpdatesPanel } from "@/lib/updates-panel-context";
import { useNewSuggestionsCount } from "@/lib/suggestions";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { APP_VERSION } from "@/lib/release-notes-data";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Home };

const operacao: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/jogos", label: "Jogos/Eventos", icon: Volleyball },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/credenciamento", label: "Credenciamento", icon: ClipboardList },
  { to: "/agenda", label: "Minha Agenda", icon: Star },
  { to: "/concluidos", label: "Concluídos", icon: CheckCircle2 },
];

const gestao: readonly NavItem[] = [
  { to: "/atletas", label: "Atletas/Clientes", icon: Users },
  { to: "/clubes", label: "Clubes", icon: Shield },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/campeonatos", label: "Campeonatos", icon: Trophy },
];

const dados: readonly NavItem[] = [
  { to: "/fontes", label: "Fontes de Jogos", icon: Download },
  { to: "/fontes-conteudo", label: "Fontes de Notícias", icon: Newspaper },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/lixeira", label: "Lixeira", icon: Trash2 },
];

const ajuda: readonly NavItem[] = [
  { to: "/primeiros-passos", label: "Primeiros passos", icon: GraduationCap },
  { to: "/novidades", label: "Novidades", icon: Megaphone },
  { to: "/sugestoes", label: "Sugestões", icon: Lightbulb },
  { to: "/em-breve", label: "Em breve", icon: Sparkles },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

const administracao: readonly NavItem[] = [
  { to: "/admin-sugestoes", label: "Sugestões dos usuários", icon: Lightbulb },
  { to: "/integracao-kiwify", label: "Integração Kiwify", icon: CreditCard },
  { to: "/privilegios", label: "Controle de Usuários", icon: UsersRound },
];

const linkClass =
  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent";
const activeProps = {
  className: "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
};

function Brand() {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-sidebar-accent cursor-pointer"
    >
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Camera className="size-3.5" />
      </div>
      <div className="text-sm font-semibold text-foreground">FotoPress</div>
    </Link>
  );
}

function NavGroup({
  label,
  items,
  onNavigate,
  badges,
}: {
  label: string;
  items: readonly NavItem[];
  onNavigate?: () => void;
  /** Contadores por rota, exibidos ao lado do item e no próprio grupo fechado. */
  badges?: Record<string, number>;
}) {
  const unread = useUnreadUpdatesCount();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const containsActive = items.some((item) => pathname.startsWith(item.to));
  const [open, setOpen] = useState(true);
  const groupTotal = Object.values(badges ?? {}).reduce((sum, n) => sum + n, 0);
  const storageKey = `fotopress:sidebar:${label}`;

  // Restaura a preferência do usuário só depois da hidratação.
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved !== null) setOpen(saved === "1");
  }, [storageKey]);

  function change(next: boolean) {
    setOpen(next);
    window.localStorage.setItem(storageKey, next ? "1" : "0");
  }

  // Mantém aberto o grupo que contém a rota atual.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <Collapsible open={open} onOpenChange={change}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground">
        {label}
        {!open && groupTotal > 0 && (
          <span className="text-[10px] font-bold normal-case tracking-normal text-primary">
            •{groupTotal}
          </span>
        )}
        <ChevronDown
          className={`ml-auto size-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={linkClass}
              activeProps={activeProps}
              onClick={onNavigate}
            >
              <div className="relative inline-flex items-center justify-center shrink-0">
                <item.icon
                  className={cn(
                    "size-4 transition-colors",
                    item.to === "/novidades" && unread > 0
                      ? "text-primary opacity-100"
                      : "opacity-70",
                  )}
                />
                {item.to === "/novidades" && unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-2 pointer-events-none">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-80" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary ring-2 ring-sidebar" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{item.label}</span>
                {item.to === "/novidades" && (
                  <span className="rounded bg-sidebar-accent/80 border border-sidebar-border px-1.5 py-0.2 font-mono text-[10px] font-semibold text-muted-foreground tracking-tight shrink-0">
                    {APP_VERSION}
                  </span>
                )}
              </div>
              {(() => {
                const count = item.to === "/novidades" ? unread : (badges?.[item.to] ?? 0);
                if (count <= 0) return null;
                if (item.to === "/novidades") {
                  return (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                        {count > 9 ? "9+" : count}
                      </span>
                    </span>
                  );
                }
                return (
                  <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {count > 9 ? "9+" : count}
                  </span>
                );
              })()}
            </Link>
          ))}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { data: isAdmin } = useIsMasterAdmin();
  const newSuggestions = useNewSuggestionsCount(!!isAdmin);
  const unreadUpdates = useUnreadUpdatesCount();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pt-5">
        <Brand />
        <div className="mb-4 mt-5 px-2">
          <QuickCreate className="w-full" />
        </div>
      </div>

      {/* somente esta área rola quando houver muitos itens */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <NavGroup label="Operação" items={operacao} onNavigate={onNavigate} />
        <NavGroup label="Gestão" items={gestao} onNavigate={onNavigate} />
        <NavGroup label="Dados e Fontes" items={dados} onNavigate={onNavigate} />
        <NavGroup
          label="Ajuda"
          items={ajuda}
          onNavigate={onNavigate}
          badges={{ "/novidades": unreadUpdates }}
        />
        {isAdmin && (
          <NavGroup
            label="Administração"
            items={administracao}
            onNavigate={onNavigate}
            badges={{ "/admin-sugestoes": newSuggestions }}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <UserMenu side="top" onAction={onNavigate} />
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-0 md:flex">
      <SidebarBody />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const unreadUpdates = useUnreadUpdatesCount();

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar px-3 py-2 md:hidden">
      <div className="flex min-w-0 items-center gap-1.5">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu" className="relative">
              <Menu className="size-5" />
              {unreadUpdates > 0 && (
                <span className="absolute top-1.5 right-1.5 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[17rem] bg-sidebar p-0">
            <SheetTitle className="sr-only">Navegação</SheetTitle>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-semibold">FotoPress</span>

        {unreadUpdates > 0 && (
          <button
            type="button"
            onClick={() => openNewsUpdatesPanel()}
            aria-label={`${unreadUpdates} novidades no FotoPress`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          >
            <div className="relative inline-flex items-center justify-center">
              <Megaphone className="size-3 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 flex size-1.5 pointer-events-none">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-80" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary ring-1 ring-background" />
              </span>
            </div>
            <span>
              {unreadUpdates} nov{unreadUpdates > 1 ? "os" : "o"}
            </span>
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <QuickCreate compact />
        <UserMenu compact />
      </div>
    </div>
  );
}
