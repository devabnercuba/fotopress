import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TemplateDownloadButtons } from "@/components/template-download";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { findTeam, teamIndex, useTeams } from "@/lib/teams";
import {
  importTypeLabel,
  persistMatches,
  recordImport,
  type PersistResult,
} from "@/services/import-service";
import { readTemplateFile, type TemplateParseResult } from "@/services/importers/template/parse";
import {
  draftToNormalizedMatch,
  duplicateKey,
  validateImportedMatch,
  type TemplateDraft,
} from "@/services/importers/template/schema";

/**
 * Contexto obrigatório da importação por arquivo: competição e temporada vêm
 * sempre da Fonte de Jogos, nunca das linhas do arquivo.
 */
export type TemplateSourceContext = {
  /** Fonte já existente; `null` quando ela ainda será criada na confirmação. */
  sourceId: string | null;
  name: string;
  competitionId: string;
  competitionName: string;
  season: string;
};

/**
 * Importação pelo Modelo Oficial FotoPress (XLSX ou PDF exportado do modelo).
 *
 * Valida o cabeçalho antes de qualquer leitura, mostra preview legível e só
 * grava depois da confirmação. A fonte só é persistida quando o arquivo é
 * aprovado, evitando fontes órfãs de arquivos inválidos.
 */
export function TemplateImportDialog({
  file,
  source,
  ensureSource,
  onClose,
  onImported,
}: {
  file: File | null;
  source: TemplateSourceContext | null;
  /** Cria (ou confirma) a fonte no momento da importação e devolve o id. */
  ensureSource?: () => Promise<string | null>;
  onClose: () => void;
  onImported: (title: string, result: PersistResult) => void;
}) {
  const { data: teams = [] } = useTeams();
  const index = useMemo(() => teamIndex(teams), [teams]);

  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState<TemplateParseResult | null>(null);
  const [rows, setRows] = useState<TemplateDraft[]>([]);
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !source) {
      setDocument(null);
      setRows([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDocument(null);
    readTemplateFile(file, { competition: source.competitionName, season: source.season })
      .then((result) => {
        if (cancelled) return;
        setDocument(result);
        setRows(result.drafts);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file, source]);

  // Jogos existentes, para apontar duplicidades (competição + data + hora + clubes).
  const { data: existing = [] } = useQuery({
    queryKey: ["matches", "template-dedupe"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("date, time, home_team, away_team, competition:competitions(name)")
        .is("deleted_at", null);
      return (data ?? []) as unknown as {
        date: string;
        time: string;
        home_team: string;
        away_team: string;
        competition: { name: string } | null;
      }[];
    },
    enabled: !!file,
  });

  const existingKeys = useMemo(
    () =>
      new Set(
        existing.map((m) =>
          duplicateKey({
            competition: m.competition?.name ?? "",
            date: m.date,
            time: m.time,
            homeTeam: m.home_team,
            awayTeam: m.away_team,
          }),
        ),
      ),
    [existing],
  );

  // Reimportação do mesmo arquivo (hash).
  const { data: previousImport } = useQuery({
    queryKey: ["import_history", "hash", document?.fileHash],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_history")
        .select("created_at, imported, file_name")
        .eq("file_hash", document!.fileHash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!document?.fileHash,
  });

  const isDuplicate = (row: TemplateDraft) =>
    !!row.date &&
    existingKeys.has(
      duplicateKey({
        competition: row.competition,
        date: row.date,
        time: row.time,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
      }),
    );

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.length - valid.length;
  const duplicates = new Set(rows.filter(isDuplicate).map((r) => r.id)).size;
  const selected = valid.filter((r) => r.selected);

  const patch = (id: string, changes: Partial<TemplateDraft>) =>
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...changes };
        return { ...next, errors: validateImportedMatch(next) };
      }),
    );

  async function confirmImport() {
    if (!document || !source) return;
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma partida válida.");
      return;
    }
    setImporting(true);
    try {
      // A fonte só nasce agora: arquivo validado e importação confirmada.
      const sourceId = ensureSource ? await ensureSource() : source.sourceId;

      const matches = selected
        .map((row) =>
          draftToNormalizedMatch(
            { ...row, competition: source.competitionName, season: source.season },
            document.fileName,
          ),
        )
        .filter((m): m is NonNullable<typeof m> => !!m);

      const result = await persistMatches(matches, {
        sourceTag: document.kind === "pdf" ? "PDF" : "Excel",
        season: source.season,
        sourceId,
        importType: importTypeLabel(document.kind === "pdf" ? "pdf" : "excel"),
        found: rows.length,
        sourceFile: document.fileName,
        operationType: "template_import",
        operationDescription: `${document.fileName} · ${source.name}`,
      });

      await recordImport({
        dataSourceId: sourceId,
        sourceType: document.kind === "pdf" ? "pdf" : "excel",
        status: "success",
        result,
        fileName: document.fileName,
        fileHash: document.fileHash,
      });

      onImported(document.fileName, result);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex max-h-[90vh] w-[min(900px,95vw)] max-w-[min(900px,95vw)] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Importação pelo modelo oficial</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{file?.name}</span>
            </DialogDescription>
          </DialogHeader>

          {source && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">
              <span className="text-muted-foreground">Fonte: </span>
              <span className="font-medium">{source.name}</span>
              <span className="text-muted-foreground"> · Campeonato: </span>
              <span className="font-medium">{source.competitionName}</span>
              <span className="text-muted-foreground"> · Temporada: </span>
              <span className="font-medium">{source.season}</span>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Validando o arquivo…
            </p>
          )}

          {error && (
            <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium">{error}</p>
              <p className="text-sm text-muted-foreground">
                Baixe o modelo oficial, organize os jogos e tente novamente.
              </p>
              <div className="flex flex-wrap gap-2">
                <TemplateDownloadButtons />
                <Button variant="outline" size="sm" onClick={onClose}>
                  Escolher outro arquivo
                </Button>
              </div>
            </div>
          )}

          {document && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {previousImport && (
                <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-comp-orange" />
                  Este arquivo já foi importado em{" "}
                  {format(parseISO(previousImport.created_at), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}{" "}
                  ({previousImport.imported} jogos). Reprocessar irá atualizar os jogos
                  correspondentes.
                </p>
              )}

              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {(
                  [
                    ["Partidas encontradas", rows.length],
                    ["Partidas válidas", valid.length],
                    ["Com erro", invalid],
                    ["Possíveis duplicados", duplicates],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border px-3 py-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-base font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2">
                {rows.map((row) => {
                  const duplicate = isDuplicate(row);
                  const newHome = row.homeTeam && !findTeam(index, row.homeTeam);
                  const newAway = row.awayTeam && !findTeam(index, row.awayTeam);
                  return (
                    <article
                      key={row.id}
                      className={`flex gap-3 rounded-lg border p-3 ${
                        row.errors.length > 0
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border"
                      }`}
                    >
                      <Checkbox
                        className="mt-1"
                        checked={row.selected && row.errors.length === 0}
                        disabled={row.errors.length > 0}
                        onCheckedChange={(v) => patch(row.id, { selected: v === true })}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {row.date
                            ? format(parseISO(row.date), "dd/MM/yyyy", { locale: ptBR })
                            : row.dateRaw || "Data ausente"}
                          {row.time ? ` · ${row.time}` : ""}
                        </p>
                        <p className="truncate text-sm font-medium">
                          {row.homeTeam || "—"} <span className="text-muted-foreground">×</span>{" "}
                          {row.awayTeam || "—"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[row.category, row.round && `Rodada ${row.round}`]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[row.venue, [row.city, row.state].filter(Boolean).join(" - ")]
                            .filter(Boolean)
                            .join(" · ") || "Local não informado"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                          {duplicate && (
                            <span className="text-comp-orange">Possível duplicado</span>
                          )}
                          {(newHome || newAway) && (
                            <span className="text-muted-foreground">
                              Novo clube:{" "}
                              {[newHome && row.homeTeam, newAway && row.awayTeam]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                        {row.errors.map((e) => (
                          <p key={e} className="mt-1 text-[11px] text-destructive">
                            {e}
                          </p>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="items-center gap-3">
            {document && (
              <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5" />
                {selected.length} de {rows.length} partidas serão importadas
              </span>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!document || importing || selected.length === 0}
              onClick={confirmImport}
            >
              {importing && <Loader2 className="size-4 animate-spin" />} Confirmar importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar partida</SheetTitle>
          </SheetHeader>
          {editing && (
            <EditForm
              row={rows.find((r) => r.id === editing.id) ?? editing}
              onChange={(changes) => patch(editing.id, changes)}
              onDone={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function EditForm({
  row,
  onChange,
  onDone,
}: {
  row: TemplateDraft;
  onChange: (changes: Partial<TemplateDraft>) => void;
  onDone: () => void;
}) {
  const field = (label: string, node: React.ReactNode) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {node}
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        {field(
          "Data",
          <Input
            type="date"
            value={row.date ?? ""}
            onChange={(e) => onChange({ date: e.target.value || null, dateRaw: e.target.value })}
          />,
        )}
        {field(
          "Hora",
          <Input
            type="time"
            value={row.time ?? ""}
            onChange={(e) => onChange({ time: e.target.value || null, timeRaw: e.target.value })}
          />,
        )}
        {field(
          "Categoria",
          <Input
            value={row.category ?? ""}
            onChange={(e) => onChange({ category: e.target.value || null })}
          />,
        )}
        {field(
          "Rodada",
          <Input
            value={row.round ?? ""}
            onChange={(e) => onChange({ round: e.target.value || null })}
          />,
        )}
      </div>
      {field(
        "Mandante",
        <Input value={row.homeTeam} onChange={(e) => onChange({ homeTeam: e.target.value })} />,
      )}
      {field(
        "Visitante",
        <Input value={row.awayTeam} onChange={(e) => onChange({ awayTeam: e.target.value })} />,
      )}
      {field(
        "Estádio/Local",
        <Input
          value={row.venue ?? ""}
          onChange={(e) => onChange({ venue: e.target.value || null })}
        />,
      )}
      <div className="grid grid-cols-2 gap-3">
        {field(
          "Cidade",
          <Input
            value={row.city ?? ""}
            onChange={(e) => onChange({ city: e.target.value || null })}
          />,
        )}
        {field(
          "UF",
          <Input
            maxLength={2}
            className="uppercase"
            value={row.state ?? ""}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase() || null })}
          />,
        )}
      </div>
      {field(
        "Observações",
        <Textarea
          rows={3}
          value={row.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
        />,
      )}
      <Button className="w-full" onClick={onDone}>
        Concluir edição
      </Button>
    </div>
  );
}
