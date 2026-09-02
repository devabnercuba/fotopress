import { format, parseISO } from "date-fns";
import { Download, Eraser, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AthleteImportDialog } from "@/components/athlete-import-dialog";
import { EmptyState } from "@/components/empty-state";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAthleteImport, useAthleteSources, type AthleteSource } from "@/lib/athletes-import";

/**
 * Fontes de atletas.
 * Cada card é uma página oficial já usada: permite reimportar (sincronizar),
 * limpar apenas os atletas ainda "crus" e excluir a fonte sem perder o CRM.
 */
export function AthleteSourcesPanel() {
  const { data: sources = [], isLoading } = useAthleteSources();
  const [importing, setImporting] = useState<AthleteSource | null>(null);
  const [newImport, setNewImport] = useState(false);
  const [cleaning, setCleaning] = useState<AthleteSource | null>(null);
  const [removing, setRemoving] = useState<AthleteSource | null>(null);
  const { clearAthletes, removeSource } = useAthleteImport();

  const confirmClean = async () => {
    if (!cleaning) return;
    try {
      const result = await clearAthletes.mutateAsync(cleaning.id);
      toast.success(
        result.removed === 0
          ? "Nenhum atleta pôde ser removido — todos têm dados seus ou histórico de contato."
          : `${result.removed} atletas importados removidos. ${result.preserved} preservados por terem dados seus ou histórico de contato.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível limpar a fonte.");
    } finally {
      setCleaning(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeSource.mutateAsync(removing.id);
      toast.success("Fonte excluída. Os atletas continuam no seu cadastro.");
    } catch {
      toast.error("Não foi possível excluir a fonte.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Páginas oficiais da CBF lidas para complementar o cadastro. Reimportar nunca sobrescreve
          dados seus.
        </p>
        <AthleteImportDialog
          open={newImport}
          onOpenChange={setNewImport}
          trigger={
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="size-4" /> Nova fonte
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando fontes…</p>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Nenhuma fonte de atletas"
          description="Cole a URL de um clube na CBF para preencher o cadastro automaticamente."
          action={
            <Button size="sm" onClick={() => setNewImport(true)}>
              <Plus className="size-4" /> Importar atletas da CBF
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sources.map((source) => (
            <li key={source.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source.name}</p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                  >
                    <Link2 className="size-3 shrink-0" /> {source.url}
                  </a>
                </div>
                <Badge variant={source.last_error ? "destructive" : "secondary"}>
                  {source.last_error ? "Erro" : "Ativa"}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                {source.last_sync_at
                  ? `Última leitura em ${format(parseISO(source.last_sync_at), "dd/MM/yyyy HH:mm")}`
                  : "Nunca sincronizada"}
                {source.team?.name ? ` · ${source.team.name}` : ""}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setImporting(source)}>
                  <RefreshCw className="size-4" /> Sincronizar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCleaning(source)}>
                  <Eraser className="size-4" /> Limpar atletas
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setRemoving(source)}
                >
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {importing && (
        <AthleteImportDialog
          key={importing.id}
          open
          onOpenChange={(open) => !open && setImporting(null)}
          sourceId={importing.id}
          initialUrl={importing.url}
        />
      )}

      <AlertDialog open={!!cleaning} onOpenChange={(open) => !open && setCleaning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar atletas desta fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão removidos apenas os atletas criados por esta importação que ainda não têm
              contato, notas ou negociação. Clientes e prospects permanecem intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClean} disabled={clearAthletes.isPending}>
              {clearAthletes.isPending && <Loader2 className="size-4 animate-spin" />} Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta fonte de atletas?</AlertDialogTitle>
            <AlertDialogDescription>
              A fonte deixa de ser sincronizada. Os atletas já importados e todo o histórico
              comercial continuam no seu cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={removeSource.isPending}>
              {removeSource.isPending && <Loader2 className="size-4 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
