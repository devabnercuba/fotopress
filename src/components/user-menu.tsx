import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, Eye, LogOut, Settings, User } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { displayName, initialsOf, useAuthUser, useProfile } from "@/lib/profile";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function UserMenu({
  compact = false,
  side = "bottom",
  onAction,
}: {
  compact?: boolean;
  side?: "top" | "bottom";
  onAction?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useAuthUser();
  const { data: profile } = useProfile();
  const { highContrast, toggleHighContrast } = useTheme();

  const name = displayName(profile, user?.email);
  const subtitle = profile?.professional_name?.trim() || profile?.bio?.trim() || user?.email || "";
  const photo = profile?.photo_url;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent",
          compact ? "max-w-[160px]" : "w-full",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {photo ? (
            <img src={photo} alt={name} className="size-full object-cover" />
          ) : (
            initialsOf(name)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">{name}</span>
          {!compact && subtitle && (
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={compact ? "end" : "start"} side={side} className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onAction?.();
            navigate({ to: "/configuracoes", hash: "perfil" });
          }}
        >
          <User className="size-4" /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onAction?.();
            navigate({ to: "/configuracoes" });
          }}
        >
          <Settings className="size-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuItem
          id="user-menu-notificacoes-link"
          onSelect={() => {
            onAction?.();
            navigate({ to: "/notificacoes" });
          }}
        >
          <Bell className="size-4" /> Notificações
        </DropdownMenuItem>
        <DropdownMenuItem
          id="user-menu-high-contrast-toggle"
          onSelect={(e) => {
            e.preventDefault();
            toggleHighContrast();
          }}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Eye className="size-4" />
            <span>Alto contraste</span>
          </div>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              highContrast
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {highContrast ? "On" : "Off"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
