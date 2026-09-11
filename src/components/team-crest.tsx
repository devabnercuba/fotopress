import { useEffect, useMemo, useState } from "react";

import { findTeam, teamAbbreviation, teamIndex, useTeams } from "@/lib/teams";

const SIZES = {
  xs: "size-4 text-[8px]",
  sm: "size-6 text-[9px]",
  md: "size-8 text-[10px]",
  lg: "size-11 text-xs",
} as const;

/**
 * Escudo do clube.
 * O escudo pertence ao clube exato: quando o `teamId` é conhecido (jogos
 * importados, atletas), ele tem prioridade sobre a busca por nome — assim
 * clubes homônimos de categorias diferentes nunca trocam de escudo.
 *
 * Ordem de prioridade da imagem: escudo no armazenamento do projeto
 * (`logo_local`, inclusive o enviado manualmente), depois a URL publicada
 * pela origem (`logo_url`) e, por fim, a sigla. Se a imagem quebrar em tempo
 * de exibição, cai para a sigla — nunca mostramos um ícone quebrado.
 */
export function TeamCrest({
  name,
  teamId,
  size = "md",
  className = "",
}: {
  name: string;
  teamId?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { data: teams = [] } = useTeams();
  const index = useMemo(() => teamIndex(teams), [teams]);
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const team = (teamId ? byId.get(teamId) : undefined) ?? findTeam(index, name);
  const src = team?.logo_local || team?.logo_url || null;
  const label = team?.abbreviation || teamAbbreviation(name);

  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  return (
    <span
      title={team?.name ?? name}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface font-semibold text-muted-foreground ${SIZES[size]} ${className}`}
    >
      {src && !broken ? (
        <img
          src={src}
          alt={`Escudo do ${team?.name ?? name}`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-contain"
        />
      ) : (
        label
      )}
    </span>
  );
}
