import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { findTeam, teamIndex, useTeams } from "@/lib/teams";
import { useCompetitions } from "@/lib/queries";
import {
  importTypeLabel,
  persistMatches,
  recordImport,
  type PersistResult,
} from "@/services/import-service";
import { readPdfDocument, type PdfDocumentResult } from "@/services/importers/pdf-importer";
import { draftToMatch } from "@/services/importers/pdf/normalize";
import type { PdfDraftMatch } from "@/services/importers/pdf/types";

type Row = PdfDraftMatch & { selected: boolean };

const CONFIDENCE_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

/**
 * Pré-visualização obrigatória da importação por PDF.
 * O usuário revisa e corrige cada partida antes de gravar; nada é importado
 * automaticamente e nenhum dado ausente é preenchido pelo sistema.
 */
export function PdfImportDialog({
  file,
  sourceId,
  sourceCompetition,
  onClose,
  onImported,
}: {
  file: File | null;
  sourceId: string | null;
  sourceCompetition?: string | null;
  onClose: () => void;
  onImported: (title: string, result: PersistResult) => void;
}) {
  const { data: competitions = [] } = useCompetitions();
  const { data: teams = [] } = useTeams();
  const index = useMemo(() => teamIndex(teams), [teams]);

  const [stage, setStage] = useState("");
  const [document, setDocument] = useState<PdfDocumentResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [competition, setCompetition] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Jogos já existentes, para apontar possíveis duplicados.
  const { data: existing = [] } = useQuery({
    queryKey: ["matches", "dedupe"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("date, time, home_team, away_team");
      return data ?? [];
    },
    enabled: !!file,
  });

  const existingKeys = useMemo(
    () =>
      new Set(
        existing.map((m) =>
          [m.date, m.home_team.toLowerCase(), m.away_team.toLowerCase()].join("|"),
        ),
      ),
    [existing],
  );

  // Reimportação do mesmo arquivo.
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

  useEffect(() => {
    if (!file) {
      setDocument(null);
      setRows([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setDocument(null);
    setStage("Lendo PDF…");
    readPdfDocument(file, sourceCompetition ?? undefined, (s) => !cancelled && setStage(s))
      .then((result) => {
        if (cancelled) return;
        setStage("Preparando pré-visualização…");
        setDocument(result);
        setRows(result.matches.map((m) => ({ ...m, selected: true })));
        setCompetition(
          sourceCompetition?.trim() || result.competition || result.matches[0]?.competition || "",
        );
        setStage("");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStage("");
        setError(e instanceof Error ? e.message : "Não foi possível ler o PDF.");
      });
    return () => {
      cancelled = true;
    };
  }, [file, sourceCompetition]);

  const patch = (id: string, changes: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const selected = rows.filter((r) => r.selected);
  const valid = selected.filter((r) => r.date && r.homeTeam && r.awayTeam);
  const duplicates = rows.filter(
    (r) =>
      r.date &&
      existingKeys.has([r.date, r.homeTeam.toLowerCase(), r.awayTeam.toLowerCase()].join("|")),
  ).length;

  async function confirmImport() {
    if (!document) return;
    if (valid.length === 0) {
      toast.error("Nenhuma partida válida selecionada. Informe pelo menos a data.");
      return;
    }
    setImporting(true);
    try {
      const matches = valid
        .map((row) => draftToMatch({ ...row, competition: competition.trim() || row.competition }))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => ({ ...m, sourceFile: document.fileName }));

      const result = await persistMatches(matches, {
        sourceTag: "PDF",
        sourceId,
        importType: importTypeLabel("pdf"),
        found: document.report.detected,
        sourceFile: document.fileName,
      });
      await recordImport({
        dataSourceId: sourceId,
        sourceType: "pdf",
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
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[min(1200px,95vw)]">
        <DialogHeader>
          <DialogTitle>Importação PDF</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <FileText className="size-3.5" /> {file?.name}
          </DialogDescription>
        </DialogHeader>

        {stage && !document && (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {stage}
          </p>
        )}

        {error && (
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Não conseguimos interpretar automaticamente esta tabela.</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}

        {document && (
          <div className="space-y-4">
            {previousImport && (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <AlertTriangle className="size-3.5 text-comp-orange" />
                Este arquivo já foi importado anteriormente ({previousImport.imported} jogos).
                Reprocessar irá atualizar os jogos correspondentes.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="pdf-competition">Competição detectada</Label>
                <Input
                  id="pdf-competition"
                  value={competition}
                  maxLength={140}
                  onChange={(e) => setCompetition(e.target.value)}
                  placeholder="Nome da competição"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Usar competição existente</Label>
                <Select onValueChange={(v) => setCompetition(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
              {(
                [
                  ["Páginas", document.report.pages],
                  ["Detectadas", document.report.detected],
                  ["Com data", document.report.withDate],
                  ["Data a definir", document.report.tbdDate],
                  ["Com horário", document.report.withTime],
                  ["Participantes indefinidos", document.report.tbdParticipants],
                  ["Possíveis duplicados", duplicates],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border px-3 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-base font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="max-h-[45vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-surface text-muted-foreground">
                  <tr>
                    {[
                      "",
                      "Data",
                      "Hora",
                      "Categoria",
                      "Mandante",
                      "Visitante",
                      "Placar",
                      "Local",
                      "Cidade",
                      "UF",
                      "Situação",
                    ].map((h) => (
                      <th key={h} className="px-2 py-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isDuplicate =
                      !!row.date &&
                      existingKeys.has(
                        [row.date, row.homeTeam.toLowerCase(), row.awayTeam.toLowerCase()].join(
                          "|",
                        ),
                      );
                    const knownHome = !!findTeam(index, row.homeTeam);
                    const knownAway = !!findTeam(index, row.awayTeam);
                    return (
                      <tr key={row.id} className="border-t border-border align-top">
                        <td className="px-2 py-1.5">
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={(v) => patch(row.id, { selected: v === true })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="date"
                            className="h-8 w-[8.5rem] text-xs"
                            value={row.date ?? ""}
                            onChange={(e) =>
                              patch(row.id, {
                                date: e.target.value || null,
                                dateStatus: e.target.value ? "defined" : "tbd",
                              })
                            }
                          />
                          {!row.date && (
                            <span className="text-[10px] text-muted-foreground">
                              Data a definir
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="time"
                            className="h-8 w-[6.5rem] text-xs"
                            value={row.time ?? ""}
                            onChange={(e) => patch(row.id, { time: e.target.value || null })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 w-32 text-xs"
                            value={[row.category, row.group, row.phase].filter(Boolean).join(" · ")}
                            onChange={(e) => patch(row.id, { category: e.target.value || null })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 w-40 text-xs"
                            value={row.homeTeam}
                            onChange={(e) => patch(row.id, { homeTeam: e.target.value })}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {row.participantsTbd
                              ? "Participante a definir"
                              : knownHome
                                ? "Clube existente"
                                : "Novo clube"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 w-40 text-xs"
                            value={row.awayTeam}
                            onChange={(e) => patch(row.id, { awayTeam: e.target.value })}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {row.participantsTbd
                              ? "Participante a definir"
                              : knownAway
                                ? "Clube existente"
                                : "Novo clube"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {row.homeScore !== null && row.awayScore !== null
                            ? `${row.homeScore} × ${row.awayScore}`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 w-44 text-xs"
                            placeholder="Local não informado"
                            value={row.venue ?? ""}
                            onChange={(e) => patch(row.id, { venue: e.target.value || null })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 w-32 text-xs"
                            value={row.city ?? ""}
                            onChange={(e) => patch(row.id, { city: e.target.value || null })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8 w-16 text-xs uppercase"
                            maxLength={2}
                            value={row.state ?? ""}
                            onChange={(e) =>
                              patch(row.id, {
                                state: e.target.value.toUpperCase() || null,
                                stateInferred: false,
                              })
                            }
                          />
                          {row.stateInferred && row.state && (
                            <span className="text-[10px] text-muted-foreground">sugerido</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-[11px]">
                            Confiança: {CONFIDENCE_LABEL[row.confidence]}
                          </span>
                          {isDuplicate && (
                            <p className="text-[10px] text-comp-orange">Possível duplicado</p>
                          )}
                          {row.warnings.map((w) => (
                            <p key={w} className="text-[10px] text-muted-foreground">
                              ⚠ {w}
                            </p>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {document.unparsed.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <button
                  type="button"
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  onClick={() => setShowRaw((v) => !v)}
                >
                  {document.unparsed.length} linhas não interpretadas —{" "}
                  {showRaw ? "ocultar" : "revisar"}
                </button>
                {showRaw && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {document.unparsed.join("\n")}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="items-center gap-3">
          {document && (
            <span className="mr-auto text-xs text-muted-foreground">
              {valid.length} de {rows.length} jogos serão importados
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmImport} disabled={importing || !document}>
            <Download className="size-4" /> Confirmar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
