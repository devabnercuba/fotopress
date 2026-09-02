import {
  AlertTriangle,
  ClipboardPaste,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CategorySelect } from "@/components/category-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeRosterUrl,
  linkPreviewRow,
  prepareImport,
  useAthleteImport,
  type PreviewRow,
} from "@/lib/athletes-import";
import { normalizeTeamName } from "@/lib/teams";
import { parseCbfRosterText } from "@/services/athletes/providers";
import type { RosterResult } from "@/services/athletes/types";

/**
 * Importar atletas da CBF
 * -----------------------
 * URL da CBF → Analisar → Preview → Confirmar. Se a CBF bloquear a leitura
 * automática, o usuário cola a própria tabela oficial (mesmo fluxo seguro).
 */

/** Atleta cujo clube atual na CBF difere do clube da página. */
function isOtherTeam(row: PreviewRow, teamName: string | null) {
  const current = row.athlete.currentTeamName;
  if (!current || !teamName) return false;
  return normalizeTeamName(current) !== normalizeTeamName(teamName);
}

export function AthleteImportDialog({
  trigger,
  sourceId,
  initialUrl,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  sourceId?: string | null;
  initialUrl?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [url, setUrl] = useState(initialUrl ?? "");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RosterResult | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pastedTeam, setPastedTeam] = useState("");
  const { run } = useAthleteImport();

  const blocked = result?.ok === false && result.errorCode === "CBF_ACCESS_BLOCKED";

  const reset = () => {
    setResult(null);
    setRows([]);
    setSelected(new Set());
    setTeamId(null);
    setTeamName(null);
  };

  const applyPreview = async (roster: RosterResult) => {
    const prepared = await prepareImport(roster, sourceId);
    setResult(roster);
    setRows(prepared.rows);
    setTeamId(prepared.teamId);
    setTeamName(prepared.teamName);
    setSelected(
      new Set(
        prepared.rows
          .filter((r) => r.action !== "unchanged" && !isOtherTeam(r, prepared.teamName))
          .map((r) => r.key),
      ),
    );
    toast.success(roster.message);
  };

  /** Vincula manualmente a linha ao atleta sugerido (nunca automático). */
  const linkExisting = async (row: PreviewRow) => {
    if (!row.suggestion) return;
    const linked = await linkPreviewRow(row, row.suggestion.id, teamId);
    setRows((prev) => prev.map((r) => (r.key === row.key ? linked : r)));
    setSelected((prev) => {
      const next = new Set(prev);
      if (linked.action === "unchanged") next.delete(row.key);
      else next.add(row.key);
      return next;
    });
  };

  const createSeparate = (row: PreviewRow) => {
    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, suggestion: null } : r)));
    setSelected((prev) => new Set(prev).add(row.key));
  };

  const ignoreRow = (row: PreviewRow) => {
    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, suggestion: null } : r)));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(row.key);
      return next;
    });
  };

  const analyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    reset();
    try {
      const roster = await analyzeRosterUrl(url.trim());
      if (!roster.ok) {
        setResult(roster);
        if (roster.errorCode !== "CBF_ACCESS_BLOCKED") toast.error(roster.message);
        return;
      }
      await applyPreview(roster);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler esta página.");
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzePasted = async () => {
    const club = pastedTeam.trim();
    if (!club) {
      toast.error("Informe o clube no FotoPress antes de analisar a lista.");
      return;
    }
    setAnalyzing(true);
    try {
      const roster = parseCbfRosterText(pasted, { url: url.trim(), teamName: club });
      if (!roster.ok) {
        toast.error(roster.message);
        setResult(roster);
        setRows([]);
        return;
      }
      await applyPreview(roster);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a lista colada.");
    } finally {
      setAnalyzing(false);
    }
  };

  const openPaste = () => {
    setPasteMode(true);
    // Sugerimos o clube mais frequente da lista, mas o usuário confirma.
    if (!pastedTeam && result?.teamName) setPastedTeam(result.teamName);
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const counts = {
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    unchanged: rows.filter((r) => r.action === "unchanged").length,
    review: rows.filter((r) => isOtherTeam(r, teamName)).length,
  };

  const confirm = async () => {
    if (!result) return;
    const chosen = rows.filter((r) => selected.has(r.key) && r.action !== "unchanged");
    if (chosen.length === 0) {
      toast.error("Selecione ao menos um atleta.");
      return;
    }
    try {
      const outcome = await run.mutateAsync({
        result,
        rows: chosen,
        teamId,
        sourceId: sourceId ?? null,
        category,
      });
      toast.success(
        `${outcome.created} atletas criados e ${outcome.updated} atualizados. Nenhum dado comercial foi alterado.`,
      );
      setOpen(false);
      setUrl("");
      setPasted("");
      setPastedTeam("");
      setPasteMode(false);
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível concluir a importação.",
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar atletas da CBF</DialogTitle>
          <DialogDescription>
            Use a página oficial de um clube na CBF para importar ou atualizar atletas. Nada é
            gravado sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roster-url">URL do clube na CBF</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="roster-url"
                value={url}
                placeholder="https://www.cbf.com.br/futebol-brasileiro/times/..."
                onChange={(event) => setUrl(event.target.value)}
              />
              <Button onClick={analyze} disabled={analyzing || !url.trim()} className="sm:w-40">
                {analyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {analyzing ? "Analisando" : "Analisar elenco"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use uma página oficial de clube em cbf.com.br.
            </p>
          </div>

          {blocked && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    Não conseguimos ler automaticamente a CBF neste momento.
                  </p>
                  <p className="text-muted-foreground">
                    Ainda é possível importar o elenco copiando a lista diretamente da página
                    oficial.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Abrir página da CBF
                  </a>
                </Button>
                <Button size="sm" variant="secondary" onClick={openPaste}>
                  <ClipboardPaste className="size-4" /> Colar lista da CBF
                </Button>
              </div>
            </div>
          )}

          {result && !result.ok && !blocked && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {result.message}
            </p>
          )}

          {pasteMode && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Importar pela lista da CBF</p>
                <p className="text-xs text-muted-foreground">
                  Na página da CBF, selecione e copie a tabela de atletas com Nome, Apelido e Clube
                  Atual. Depois cole abaixo.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="paste-team">Clube no FotoPress</Label>
                <Input
                  id="paste-team"
                  value={pastedTeam}
                  placeholder="Ex.: Brusque"
                  onChange={(event) => setPastedTeam(event.target.value)}
                />
              </div>
              <Textarea
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                placeholder="Cole a lista aqui..."
                className="min-h-40 font-mono text-xs"
              />
              <Button size="sm" onClick={analyzePasted} disabled={analyzing || !pasted.trim()}>
                {analyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Analisar lista
              </Button>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="gap-1">
                  <Link2 className="size-3" /> {result?.providerLabel}
                </Badge>
                {teamName && <Badge variant="outline">{teamName}</Badge>}
                <Badge variant="outline">{counts.create} novos</Badge>
                <Badge variant="outline">{counts.update} a atualizar</Badge>
                <Badge variant="outline">{counts.unchanged} sem alteração</Badge>
                {counts.review > 0 && <Badge variant="outline">{counts.review} para revisar</Badge>}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                <div className="space-y-1">
                  <Label>Categoria (opcional)</Label>
                  <CategorySelect value={category} onChange={setCategory} />
                </div>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  Telefone, WhatsApp, e-mail, notas e funil comercial nunca são alterados pela
                  importação.
                </p>
              </div>

              <ScrollArea className="h-72 rounded-lg border border-border">
                <ul className="divide-y divide-border">
                  {rows.map((row) => (
                    <li key={row.key} className="flex items-start gap-3 p-3">
                      <Checkbox
                        checked={selected.has(row.key)}
                        disabled={row.action === "unchanged"}
                        onCheckedChange={() => toggle(row.key)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {row.athlete.fullName ?? row.athlete.name}
                          </p>
                          {row.athlete.shirtNumber !== null &&
                            row.athlete.shirtNumber !== undefined && (
                              <Badge variant="outline" className="tabular-nums">
                                #{row.athlete.shirtNumber}
                              </Badge>
                            )}
                          {row.athlete.position && (
                            <span className="text-xs text-muted-foreground">
                              {row.athlete.position}
                            </span>
                          )}
                          <Badge
                            variant={row.action === "create" ? "default" : "secondary"}
                            className="ml-auto"
                          >
                            {row.action === "create"
                              ? "Novo"
                              : row.action === "update"
                                ? "Complementar"
                                : "Sem alteração"}
                          </Badge>
                        </div>
                        {isOtherTeam(row, teamName) && (
                          <p className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="destructive">Clube atual diferente</Badge>
                            <span className="text-xs text-muted-foreground">
                              CBF informa clube atual: {row.athlete.currentTeamName}
                            </span>
                          </p>
                        )}
                        {row.athlete.nickname && (
                          <p className="truncate text-xs text-muted-foreground">
                            Apelido: {row.athlete.nickname}
                          </p>
                        )}
                        {row.suggestion && (
                          <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-2">
                            <p className="text-xs font-medium">Possível correspondência</p>
                            <p className="text-xs text-muted-foreground">
                              No FotoPress: <strong>{row.suggestion.name}</strong>
                              {row.suggestion.nickname
                                ? ` (apelido: ${row.suggestion.nickname})`
                                : ""}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button size="sm" variant="outline" onClick={() => linkExisting(row)}>
                                Usar existente
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => createSeparate(row)}>
                                Criar separado
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => ignoreRow(row)}>
                                Ignorar
                              </Button>
                            </div>
                          </div>
                        )}
                        {row.existingName && (
                          <p className="text-xs text-muted-foreground">
                            Já cadastrado como <strong>{row.existingName}</strong>
                            {row.matchedBy ? ` (${row.matchedBy})` : ""}
                            {row.fills.length > 0 && ` · preenche: ${row.fills.join(", ")}`}
                            {row.preserved.length > 0 && ` · preserva: ${row.preserved.join(", ")}`}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={run.isPending || rows.length === 0}>
            {run.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Importar selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
