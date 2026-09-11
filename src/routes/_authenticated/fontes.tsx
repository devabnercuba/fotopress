import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  Eraser,
  History,
  ListChecks,
  Pencil,
  Plus,
  PlugZap,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { SearchableCompetitionSelect } from "@/components/searchable-competition-select";
import { TemplateDownloadButtons, TemplateImportBlock } from "@/components/template-download";
import {
  TemplateImportDialog,
  type TemplateSourceContext,
} from "@/components/template-import-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { restoreDeletionBatch, undoImportBatch } from "@/lib/batches";
import {
  useDataSourceMutations,
  useDataSources,
  type DataSource,
  type DataSourceInput,
} from "@/lib/data-sources";
import { useCompetitions } from "@/lib/queries";
import { listCbfCompetitionsFn } from "@/lib/federation-catalog.functions";
import { listFpfCompetitionsFn } from "@/lib/fpf-import.functions";
import { useSportPreferences } from "@/lib/sport-preferences";
import { useSportTerminology } from "@/lib/sport-terminology";
import { isFcfUrl } from "@/services/importers/fcf-source";
import { parseFpfUrl } from "@/services/importers/fpf-source";
import {
  detectLnfCompetition,
  isLnfUrl,
  validateLnfUrl,
  LNF_COMPETITIONS,
} from "@/services/importers/lnf-source";
import { getImporter, runImport, type PersistResult } from "@/services/import-service";
import type { ImportProgressInfo } from "@/services/importers/types";

export const Route = createFileRoute("/_authenticated/fontes")({
  head: () => ({
    meta: [
      { title: "Fontes de Jogos — Cobertura esportiva" },
      {
        name: "description",
        content:
          "Centro de importação: alimente a base de jogos por URL ou pelo modelo oficial FotoPress (XLSX/PDF).",
      },
      { property: "og:title", content: "Fontes de Jogos — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Importe jogos por URL ou pelo modelo oficial, com preview e desfazer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataSourcesPage,
});

/** Fontes que sincronizam sozinhas a partir de um endereço público. */
const AUTO_TYPES = ["url", "lnf", "fpf"];

/**
 * Provedores oficiais. O provedor é apenas a forma de escolher a competição na
 * tela: CBF e FCF continuam gravados como fontes do tipo `url`, lidas pelos
 * mesmos importadores de sempre.
 */
const PROVIDER_GROUPS = [
  {
    sport: "futebol",
    label: "Futebol de campo",
    options: [
      { value: "cbf", label: "CBF — Confederação Brasileira de Futebol" },
      { value: "fcf", label: "FCF — Federação Catarinense de Futebol" },
      { value: "fpf", label: "FPF — Federação Paulista de Futebol" },
    ],
  },
  {
    sport: "futsal",
    label: "Futsal",
    options: [{ value: "lnf", label: "LNF — Liga Nacional de Futsal" }],
  },
  {
    sport: "outros",
    label: "Qualquer modalidade",
    options: [{ value: "pdf", label: "Arquivo — modelo oficial FotoPress" }],
  },
] as const;

/** Provedor → tipo gravado no banco (CBF e FCF seguem sendo `url`). */
const providerType = (provider: string) =>
  provider === "cbf" || provider === "fcf" ? "url" : provider;

/** Fontes já cadastradas: o provedor é reconhecido pela URL salva. */
function detectProvider(type: string, url: string | null) {
  if (type !== "url") return type;
  if (url && isFcfUrl(url)) return "fcf";
  return "cbf";
}

const TYPE_LABEL: Record<string, string> = {
  url: "URL",
  lnf: "LNF",
  fpf: "FPF",
  pdf: "Arquivo (modelo oficial)",
  excel: "Arquivo (modelo oficial)",
  csv: "Arquivo (modelo oficial)",
};

const EMPTY_FORM = {
  id: "",
  name: "",
  provider: "cbf",
  competition_id: "",
  season: String(new Date().getFullYear()),
  url: "",
  file_name: "",
  status: "active",
};

type Form = typeof EMPTY_FORM;

function DataSourcesPage() {
  const qc = useQueryClient();
  const { primarySport } = useSportPreferences();
  const terminology = useSportTerminology();
  const isFutebol = primarySport === "futebol";
  const { data: sources = [], isLoading } = useDataSources();
  const { create, update, remove, clearMatches, touchSync } = useDataSourceMutations();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState<DataSource | null>(null);
  const [clearing, setClearing] = useState<DataSource | null>(null);
  const [report, setReport] = useState<{ title: string; result: PersistResult } | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<ImportProgressInfo | null>(null);

  // Importação pelo modelo oficial (XLSX ou PDF exportado do modelo).
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importContext, setImportContext] = useState<TemplateSourceContext | null>(null);
  /** Fonte ainda não gravada: só nasce quando o arquivo é aprovado no preview. */
  const [pendingSource, setPendingSource] = useState<DataSourceInput | null>(null);

  const { data: competitions = [] } = useCompetitions();
  const competitionName = (id: string | null | undefined) =>
    competitions.find((c) => c.id === id)?.name ?? "";

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  /** Tipo gravado no banco a partir do provedor escolhido. */
  const formType = providerType(form.provider);
  /** Fontes que sincronizam sozinhas a partir de uma URL pública. */
  const isUrlSource = AUTO_TYPES.includes(formType);
  const isFileSource = !isUrlSource;
  /** Modalidades ativas apenas ordenam as opções — nada some da lista. */
  const { sports: activeSports } = useSportPreferences();
  const typeGroups = useMemo(() => {
    const rank = (key: string) => {
      const index = activeSports.indexOf(key);
      return index === -1 ? 99 : index;
    };
    return [...PROVIDER_GROUPS].sort((a, b) => rank(a.sport) - rank(b.sport));
  }, [activeSports]);

  const season = /^\d{4}$/.test(form.season.trim()) ? form.season.trim() : "";

  /** Competições publicadas pela FPF na temporada informada. */
  const fpfQuery = useQuery({
    enabled: form.provider === "fpf" && !!season,
    queryKey: ["fpf-competitions", season],
    queryFn: () => listFpfCompetitionsFn({ data: { season } }),
    staleTime: 10 * 60 * 1000,
  });
  const fpfSeason = season;
  const fpfCompetitions = fpfQuery.data?.competitions ?? [];
  const fpfSelected = parseFpfUrl(form.url);

  /** Competições oficiais publicadas pela CBF (portal de credenciamento). */
  const cbfQuery = useQuery({
    enabled: form.provider === "cbf",
    queryKey: ["cbf-competitions"],
    queryFn: () => listCbfCompetitionsFn(),
    staleTime: 30 * 60 * 1000,
  });
  const cbfCompetitions = cbfQuery.data?.competitions ?? [];
  const cbfSelected = cbfCompetitions.find((c) => c.url === form.url.trim())?.id ?? "";

  const refreshMatches = () => {
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["competitions"] });
    qc.invalidateQueries({ queryKey: ["teams"] });

    qc.invalidateQueries({ queryKey: ["data_sources"] });
    qc.invalidateQueries({ queryKey: ["import_history"] });
    qc.invalidateQueries({ queryKey: ["operation-batches"] });
  };

  function openNewSource(provider: string) {
    setForm({ ...EMPTY_FORM, provider });
    setPendingFile(null);
    setOpen(true);
  }

  /**
   * Fontes por arquivo só são gravadas depois que o arquivo passa na validação
   * e a importação é confirmada — assim nunca sobra fonte órfã de um arquivo
   * recusado. Campeonato e temporada da fonte definem os jogos importados.
   */
  function submit() {
    if (!form.name.trim()) {
      toast.error("Informe o nome da fonte.");
      return;
    }
    if (isUrlSource && !form.url.trim()) {
      toast.error("Informe a URL da tabela.");
      return;
    }
    if (form.provider === "fcf") {
      if (!isFcfUrl(form.url.trim())) {
        toast.error("Cole a URL oficial da tabela eGol (egol.fcf.com.br).");
        return;
      }
    }
    if (form.provider === "fpf") {
      if (!parseFpfUrl(form.url.trim())) {
        toast.error("Selecione a competição oficial da FPF.");
        return;
      }
      if (!form.season.trim()) {
        toast.error("Informe a temporada desta fonte.");
        return;
      }
    }
    if (form.provider === "lnf") {
      if (!validateLnfUrl(form.url.trim())) {
        toast.error("Selecione uma competição LNF ou informe uma tabela oficial da LNF.");
        return;
      }
      if (!form.season.trim()) {
        toast.error("Informe a temporada desta fonte.");
        return;
      }
    }
    if (isFileSource) {
      if (!form.competition_id) {
        toast.error("Selecione o campeonato desta fonte.");
        return;
      }
      if (!form.season.trim()) {
        toast.error("Informe a temporada desta fonte.");
        return;
      }
      if (!form.id && !pendingFile) {
        toast.error("Envie o arquivo preenchido no modelo oficial.");
        return;
      }
    }

    const payload: DataSourceInput = {
      name: form.name.trim(),
      type: formType,
      competition_id: form.competition_id || null,
      season: form.season,
      url: isUrlSource ? form.url.trim() : null,
      file_name: isUrlSource ? null : (pendingFile?.name ?? form.file_name ?? null),
      status: form.status,
    };

    const startImport = (sourceId: string | null) => {
      const file = pendingFile!;
      setImportContext({
        sourceId,
        name: payload.name,
        competitionId: payload.competition_id!,
        competitionName: competitionName(payload.competition_id),
        season: payload.season,
      });
      setPendingSource(sourceId ? null : payload);
      setImportFile(file);
    };

    const closeForm = () => {
      setOpen(false);
      setForm(EMPTY_FORM);
      setPendingFile(null);
    };

    if (form.id) {
      const editingId = form.id;
      const file = pendingFile;
      update.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            toast.success("Fonte atualizada.");
            if (file) startImport(editingId);
            closeForm();
          },
          onError: () => toast.error("Não foi possível salvar."),
        },
      );
      return;
    }

    if (isFileSource) {
      // Só valida agora; a fonte nasce na confirmação do preview.
      startImport(null);
      closeForm();
      return;
    }

    create.mutate(payload, {
      onSuccess: () => {
        toast.success("Fonte cadastrada.");
        closeForm();
      },
      onError: () => toast.error("Não foi possível salvar a fonte."),
    });
  }

  /** Cria a fonte pendente (ou confirma a existente) no momento da importação. */
  async function ensureImportSource(): Promise<string | null> {
    if (importContext?.sourceId) return importContext.sourceId;
    if (!pendingSource) return null;
    const id = await create.mutateAsync(pendingSource);
    setPendingSource(null);
    setImportContext((c) => (c ? { ...c, sourceId: id } : c));
    return id;
  }

  async function testSource(source: DataSource) {
    const importer = getImporter(source.type);
    if (!importer.test) {
      toast("Teste disponível apenas para fontes por URL.");
      return;
    }
    setTesting(true);
    try {
      const result = await importer.test({
        url: source.url ?? undefined,
        competition: source.competition?.name ?? source.name,
        season: source.season,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível interpretar esta URL.",
      );
    } finally {
      setTesting(false);
    }
  }

  /** URL e LNF sincronizam direto. Arquivo pede um novo envio do modelo. */
  async function sync(source: DataSource) {
    if (syncingId) {
      toast.info("Uma sincronização já está em andamento. Aguarde a conclusão.");
      return;
    }
    if (!AUTO_TYPES.includes(source.type)) {
      if (!source.competition_id) {
        toast.error("Defina o campeonato desta fonte antes de importar um arquivo.");
        return;
      }
      setPendingSource(null);
      setImportContext({
        sourceId: source.id,
        name: source.name,
        competitionId: source.competition_id,
        competitionName: source.competition?.name ?? competitionName(source.competition_id),
        season: source.season,
      });
      const input = window.document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.xlsx,.xls,.csv";
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        if (file) setImportFile(file);
      };
      input.click();
      return;
    }
    setSyncingId(source.id);
    setSyncStep({ step: "fetch", message: "Conectando à fonte..." });
    try {
      const result = await runImport({
        dataSourceId: source.id,
        type: source.type,
        url: source.url,
        competition: source.competition?.name ?? source.name,
        season: source.season,
        onProgress: (info) => {
          setSyncStep(info);
        },
      });
      refreshMatches();
      setReport({ title: source.name, result });
    } catch (error) {
      refreshMatches();
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar.");
    } finally {
      setSyncingId(null);
      setSyncStep(null);
      touchSync.mutate(source.id);
    }
  }

  function editSource(source: DataSource) {
    setForm({
      id: source.id,
      name: source.name,
      provider: detectProvider(source.type, source.url),
      competition_id: source.competition_id ?? "",
      season: source.season,
      url: source.url ?? "",
      file_name: source.file_name ?? "",
      status: source.status,
    });
    setPendingFile(null);
    setOpen(true);
  }

  /** Toast com desfazer após uma operação destrutiva. */
  function undoToast(message: string, batchId: string | null) {
    toast.success(message, {
      duration: 10000,
      ...(batchId
        ? {
            action: {
              label: "DESFAZER",
              onClick: async () => {
                try {
                  await restoreDeletionBatch(batchId);
                  refreshMatches();
                  toast.success("Operação desfeita.");
                } catch {
                  toast.error("Não foi possível desfazer.");
                }
              },
            },
          }
        : {}),
    });
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isFutebol
              ? "Fontes de Jogos"
              : terminology.dataSourceLabel === "Fonte de jogos"
                ? "Fontes de Jogos"
                : "Fontes de Eventos"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFutebol
              ? "Centro de importação: URL (CBF/FCF), FPF, LNF e arquivos no modelo oficial FotoPress."
              : `Centro de importação: ${terminology.dataSourceLabel.toLowerCase()} por URL ou pelo modelo oficial FotoPress.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/historico">
              <History className="size-4" /> Histórico
            </Link>
          </Button>
          <Button onClick={() => openNewSource("cbf")}>
            <Plus className="size-4" /> Nova Fonte
          </Button>
        </div>
      </header>

      <TemplateImportBlock onPickFile={() => openNewSource("pdf")} />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && sources.length === 0 && (
        <EmptyState
          icon={Download}
          title="Nenhuma fonte adicionada"
          description="Importe partidas automaticamente pela CBF, FCF, FPF ou LNF, ou utilize o modelo oficial em PDF/XLSX."
          action={
            <Button size="sm" onClick={() => openNewSource("cbf")}>
              Adicionar fonte
            </Button>
          }
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <article
            key={source.id}
            className="flex flex-col rounded-xl border border-border bg-card p-5"
          >
            <h2 className="truncate text-sm font-medium" title={source.name}>
              {source.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {source.competition?.name ?? `Temporada ${source.season}`}
            </p>

            <dl className="mt-5 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="truncate">{TYPE_LABEL[source.type] ?? source.type}</dd>
              </div>
              {source.file_name && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Arquivo</dt>
                  <dd className="truncate" title={source.file_name}>
                    {source.file_name}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className={source.status === "active" ? "text-comp-green" : ""}>
                  {source.status === "active" ? "Ativo" : "Inativo"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Última importação</dt>
                <dd>
                  {source.last_update || source.last_sync
                    ? format(
                        parseISO((source.last_update ?? source.last_sync)!),
                        "dd/MM/yyyy HH:mm",
                        {
                          locale: ptBR,
                        },
                      )
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Jogos importados</dt>
                <dd>{source.games_count ?? 0}</dd>
              </div>
            </dl>

            {source.last_error && (
              <p className="mt-3 truncate text-xs text-destructive" title={source.last_error}>
                {source.last_error}
              </p>
            )}

            {syncingId === source.id && syncStep && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/70 px-2.5 py-1.5 text-xs text-foreground">
                <RefreshCw className="size-3 shrink-0 animate-spin text-primary" />
                <span className="truncate">{syncStep.message}</span>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-border pt-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/jogos" search={{ source: source.id }}>
                  <ListChecks className="size-3.5" /> Ver jogos
                </Link>
              </Button>
              <Button variant="ghost" size="sm" disabled={!!syncingId} onClick={() => sync(source)}>
                <RefreshCw
                  className={`size-3.5 ${syncingId === source.id ? "animate-spin" : ""}`}
                />
                {syncingId === source.id
                  ? "Sincronizando..."
                  : AUTO_TYPES.includes(source.type)
                    ? "Sincronizar"
                    : "Reprocessar"}
              </Button>
              {AUTO_TYPES.includes(source.type) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={testing}
                  onClick={() => testSource(source)}
                >
                  <PlugZap className="size-3.5" /> Testar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => editSource(source)}>
                <Pencil className="size-3.5" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={clearMatches.isPending}
                onClick={() => setClearing(source)}
              >
                <Eraser className="size-3.5" /> Limpar jogos
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/historico">
                  <History className="size-3.5" /> Histórico
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                title="Excluir fonte"
                onClick={() => setDeleting(source)}
              >
                <Trash2 className="size-3.5 opacity-70" />
              </Button>
            </div>
          </article>
        ))}
      </section>

      <AlertDialog open={!!clearing} onOpenChange={(open) => !open && setClearing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar jogos de “{clearing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão removidos {clearing?.games_count ?? 0} jogos importados por esta fonte. A
              exclusão é reversível: você poderá desfazer logo em seguida ou restaurar pela Lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearMatches.isPending}
              onClick={() => {
                if (!clearing) return;
                clearMatches.mutate(clearing.id, {
                  onSuccess: ({ removed, batchId }) =>
                    undoToast(`${removed} jogos removidos desta fonte.`, batchId),
                  onError: () => toast.error("Não foi possível limpar os jogos desta fonte."),
                });
                setClearing(null);
              }}
            >
              Limpar jogos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Relatório da importação */}
      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado da importação</DialogTitle>
            <DialogDescription>{report?.title}</DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {report &&
              (
                [
                  ["Encontrados", report.result.found],
                  ["Importados", report.result.imported],
                  ["Atualizados", report.result.updated],
                  ["Iguais", report.result.skipped],
                  ["Erros", report.result.errors.length],
                  ["Campeonatos criados", report.result.competitionsCreated],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-base font-semibold">{value}</dd>
                </div>
              ))}
          </dl>

          {report && report.result.errors.length > 0 && (
            <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-border p-3">
              {report.result.errors.map((issue, i) => (
                <p key={i} className="text-xs">
                  <span className="font-medium">{issue.match}</span>
                  <span className="text-muted-foreground"> — {issue.reason}</span>
                </p>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" asChild>
              <Link to="/jogos">Ver jogos</Link>
            </Button>
            {report && report.result.imported > 0 && (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    const removed = await undoImportBatch(
                      report.result.importBatchId,
                      report.result.operationBatchId,
                    );
                    refreshMatches();
                    setReport(null);
                    toast.success(`Importação desfeita (${removed} jogos removidos).`);
                  } catch {
                    toast.error("Não foi possível desfazer a importação.");
                  }
                }}
              >
                Desfazer importação
              </Button>
            )}
            <Button onClick={() => setReport(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover também os jogos importados por esta fonte? Se escolher “Não”, os jogos
              permanecem no banco sem vínculo com a fonte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                if (!deleting) return;
                remove.mutate(
                  { id: deleting.id, withMatches: false, name: deleting.name },
                  {
                    onSuccess: () => toast.success("Fonte excluída. Os jogos foram mantidos."),
                    onError: () => toast.error("Não foi possível excluir a fonte."),
                  },
                );
                setDeleting(null);
              }}
            >
              Não, manter os jogos
            </Button>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => {
                if (!deleting) return;
                remove.mutate(
                  { id: deleting.id, withMatches: true, name: deleting.name },
                  {
                    onSuccess: ({ removed, batchId }) =>
                      undoToast(`Fonte excluída e ${removed} jogos removidos.`, batchId),
                    onError: () => toast.error("Não foi possível excluir a fonte."),
                  },
                );
                setDeleting(null);
              }}
            >
              Sim, excluir os jogos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nova fonte / edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[min(520px,95vw)] max-w-[min(520px,95vw)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar fonte" : "Nova fonte"}</DialogTitle>
            <DialogDescription>Origem dos jogos que alimentam o calendário.</DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="source-name">Nome da fonte</Label>
              <Input
                id="source-name"
                className="w-full"
                value={form.name}
                maxLength={120}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Tabela Campeonato Municipal 2026"
              />
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v) => {
                    set({
                      provider: v,
                      // LNF já nasce apontando para a tabela oficial principal.
                      ...(v === "lnf" && !validateLnfUrl(form.url)
                        ? { url: LNF_COMPETITIONS[0].url }
                        : {}),
                      // Os demais provedores escolhem a competição na lista oficial.
                      ...(v === "fpf" && !parseFpfUrl(form.url) ? { url: "" } : {}),
                      ...(v === "cbf" ? { url: "" } : {}),
                      ...(v === "fcf" && !isFcfUrl(form.url) ? { url: "" } : {}),
                    });
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeGroups.map((group) => (
                      <SelectGroup key={group.sport}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="source-season">
                  Temporada{isFileSource || form.provider !== "cbf" ? " *" : ""}
                </Label>
                <Input
                  id="source-season"
                  className="w-full"
                  value={form.season}
                  maxLength={9}
                  onChange={(e) => set({ season: e.target.value })}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label>Campeonato{isFileSource ? " *" : ""}</Label>
              <div className="min-w-0">
                <SearchableCompetitionSelect
                  value={form.competition_id || null}
                  onChange={(id) => set({ competition_id: id })}
                  placeholder={
                    isFileSource
                      ? "Selecione o campeonato desta fonte"
                      : "Selecione o campeonato (opcional)"
                  }
                />
              </div>
              {isFileSource && (
                <p className="text-xs text-muted-foreground">
                  Todos os jogos do arquivo entram neste campeonato e temporada. O arquivo não traz
                  essas colunas.
                </p>
              )}
            </div>

            {isUrlSource ? (
              <div className="min-w-0 space-y-3">
                {form.provider === "lnf" && (
                  <div className="min-w-0 space-y-1.5">
                    <Label>Competição LNF *</Label>
                    <Select
                      value={detectLnfCompetition(form.url).id}
                      onValueChange={(id) => {
                        const preset = LNF_COMPETITIONS.find((c) => c.id === id);
                        if (preset)
                          set({
                            url: preset.url,
                            name: form.name || `${preset.label} ${form.season}`,
                          });
                      }}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Selecione a competição" />
                      </SelectTrigger>
                      <SelectContent>
                        {LNF_COMPETITIONS.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      A URL oficial é preenchida automaticamente. Você pode ajustá-la se precisar.
                    </p>
                  </div>
                )}
                {form.provider === "cbf" && (
                  <div className="min-w-0 space-y-1.5">
                    <Label>Competição CBF *</Label>
                    <Select
                      value={cbfSelected}
                      disabled={cbfQuery.isFetching}
                      onValueChange={(id) => {
                        const preset = cbfCompetitions.find((c) => c.id === id);
                        if (preset) set({ url: preset.url, name: form.name || preset.label });
                      }}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue
                          placeholder={
                            cbfQuery.isFetching
                              ? "Carregando competições…"
                              : "Selecione a competição"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {cbfCompetitions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {cbfQuery.data && !cbfQuery.data.ok
                        ? cbfQuery.data.message
                        : "A lista vem do portal oficial da CBF. A URL da tabela é preenchida automaticamente."}
                    </p>
                  </div>
                )}
                {form.provider === "fcf" && (
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="fcf-url">URL da tabela FCF *</Label>
                    <Input
                      id="fcf-url"
                      className="w-full"
                      value={form.url}
                      maxLength={500}
                      onChange={(e) => set({ url: e.target.value })}
                      placeholder="https://egol.fcf.com.br/sisgol/DERW700B.asp?..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Cole o endereço da tabela oficial eGol da competição.
                    </p>
                  </div>
                )}
                {form.provider === "fpf" && (
                  <div className="min-w-0 space-y-1.5">
                    <Label>Competição FPF *</Label>
                    <Select
                      value={fpfSelected ? String(fpfSelected.idCampeonato) : ""}
                      disabled={!fpfSeason || fpfQuery.isFetching}
                      onValueChange={(id) => {
                        const preset = fpfCompetitions.find((c) => String(c.idCampeonato) === id);
                        if (preset) {
                          set({
                            url: preset.url,
                            season: preset.season,
                            name: form.name || `${preset.label} ${preset.season}`,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue
                          placeholder={
                            fpfQuery.isFetching
                              ? "Carregando competições…"
                              : "Selecione a competição"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {fpfCompetitions.map((c) => (
                          <SelectItem key={c.idCampeonato} value={String(c.idCampeonato)}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {fpfQuery.data && !fpfQuery.data.ok
                        ? fpfQuery.data.message
                        : "A sincronização traz o calendário completo (todas as rodadas), com escudos oficiais."}
                    </p>
                  </div>
                )}
                {form.provider !== "fcf" && (
                  <details className="min-w-0 rounded-md border border-border px-3 py-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Configurações avançadas
                    </summary>
                    <div className="min-w-0 space-y-1.5 pt-3">
                      <Label htmlFor="source-url">URL da tabela</Label>
                      <Input
                        id="source-url"
                        className="w-full"
                        value={form.url}
                        maxLength={500}
                        onChange={(e) => set({ url: e.target.value })}
                        placeholder={
                          form.provider === "lnf"
                            ? "https://lnfoficial.com.br/tabela-de-jogos/"
                            : "Preenchida ao escolher a competição oficial"
                        }
                      />
                      {form.provider !== "lnf" && isLnfUrl(form.url) && (
                        <p className="text-xs text-muted-foreground">
                          Esta URL é compatível com o importador LNF.{" "}
                          <button
                            type="button"
                            className="underline underline-offset-2"
                            onClick={() => set({ provider: "lnf" })}
                          >
                            Usar LNF
                          </button>
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="min-w-0 space-y-2">
                <Label htmlFor="source-file">Upload do arquivo (PDF ou XLSX do modelo)</Label>
                <Input
                  id="source-file"
                  type="file"
                  className="w-full"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    set({ file_name: file?.name ?? form.file_name });
                    setPendingFile(file);
                  }}
                />
                <TemplateDownloadButtons />
                <p className="text-xs text-muted-foreground">
                  {form.file_name ? `Atual: ${form.file_name}. ` : ""}A validação e o preview abrem
                  ao salvar. Não altere a estrutura do modelo.
                </p>
              </div>
            )}

            <div className="min-w-0 space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {isFileSource && pendingFile ? (
                <>
                  <Upload className="size-4" /> Salvar e validar arquivo
                </>
              ) : (
                "Salvar fonte"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validação + preview do modelo oficial */}
      <TemplateImportDialog
        file={importFile}
        source={importContext}
        ensureSource={ensureImportSource}
        onClose={() => {
          setImportFile(null);
          setImportContext(null);
          setPendingSource(null);
        }}
        onImported={(title, result) => {
          setReport({ title, result });
          refreshMatches();
        }}
      />
    </div>
  );
}
