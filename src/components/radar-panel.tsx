import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeftRight,
  Camera,
  CalendarClock,
  ExternalLink,
  Link2,
  Newspaper,
  RefreshCw,
  Trophy,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Coverage } from "@/lib/coverages";
import { RADAR_LABEL, RADAR_DOT, radarState, useRadarSync, type Radar } from "@/lib/radar";
import { useMatchIntel, type IntelItem, type OgolFeedType } from "@/lib/ogol";

function Block({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Newspaper;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-snug text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function friendlyDate(value: string | null) {
  if (!value) return "";
  const date = parseISO(value);
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days < 2) return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

/** Conteúdo vindo de fontes integradas — sempre com atribuição e link original. */
function IntelBlock({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Newspaper;
  title: string;
  items: IntelItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-surface/50 p-3">
            <p className="text-sm leading-snug">{item.title}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Fonte: {item.source_name}</span>
              <span>·</span>
              <span>{friendlyDate(item.published_at)}</span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 hover:underline"
              >
                Abrir no oGol <ExternalLink className="size-3" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const INTEL_BLOCKS: { feed: OgolFeedType; title: string; icon: typeof Newspaper }[] = [
  { feed: "news", title: "Últimas notícias", icon: Newspaper },
  { feed: "transfer", title: "Mercado / transferências", icon: ArrowLeftRight },
  { feed: "result", title: "Resultados recentes", icon: Trophy },
  { feed: "upcoming_match", title: "Próximos jogos", icon: CalendarClock },
];

export function RadarPanel({ coverage, radar }: { coverage: Coverage; radar?: Radar | null }) {
  const sync = useRadarSync();
  const state = radarState(radar);
  const match = coverage.match;
  const intel = useMatchIntel(match);
  const intelTotal = INTEL_BLOCKS.reduce(
    (sum, block) => sum + (intel.data?.[block.feed]?.length ?? 0),
    0,
  );

  if (!match) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`size-2 rounded-full ${RADAR_DOT[state]}`} />
          {RADAR_LABEL[state]}
          {radar?.last_synced_at && (
            <>
              {" · "}
              {format(parseISO(radar.last_synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={sync.isPending}
          onClick={() =>
            sync.mutate(
              { match, coverageId: coverage.id },
              {
                onSuccess: (r) =>
                  toast.success(
                    r.sourcesUsed
                      ? `Radar sincronizado com ${r.sourcesUsed} fonte(s) de conteúdo.`
                      : "Radar sincronizado. Cadastre Fontes de Conteúdo para enriquecer o resumo.",
                  ),
                onError: () => toast.error("Não foi possível sincronizar o radar."),
              },
            )
          }
        >
          <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
          Sincronizar Radar
        </Button>
      </div>

      {!radar ? (
        <p className="text-sm text-muted-foreground">
          Radar ainda não gerado para esta cobertura. Sincronize para montar o resumo operacional.
        </p>
      ) : (
        <>
          <section>
            <h3 className="text-xs font-medium text-muted-foreground">Resumo da partida</h3>
            <p className="mt-2 text-sm leading-relaxed">{radar.summary}</p>
          </section>

          <Block icon={Newspaper} title="Notícias encontradas" items={radar.news} />
          <Block icon={TriangleAlert} title="Pontos de atenção" items={radar.attention_points} />
          <Block icon={Camera} title="Fotos prioritárias" items={radar.photo_suggestions} />
          <Block
            icon={Link2}
            title="Fontes utilizadas"
            items={radar.sources_used.map((s) => (s.url ? `${s.name} — ${s.url}` : s.name))}
          />
        </>
      )}

      <div className="space-y-6 border-t border-border pt-6">
        {INTEL_BLOCKS.map((block) => (
          <IntelBlock
            key={block.feed}
            icon={block.icon}
            title={block.title}
            items={intel.data?.[block.feed] ?? []}
          />
        ))}
        {!intel.isLoading && intelTotal === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma informação recente encontrada nesta fonte.
          </p>
        )}
      </div>
    </div>
  );
}
