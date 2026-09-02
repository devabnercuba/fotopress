import { Download, FileSpreadsheet, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TEMPLATE_PDF, TEMPLATE_XLSX } from "@/services/importers/template/schema";

/** Botões que entregam os arquivos oficiais publicados em /public/templates. */
export function TemplateDownloadButtons({ size = "sm" }: { size?: "sm" | "default" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size={size}>
        <a href={TEMPLATE_XLSX} download>
          <FileSpreadsheet className="size-4" /> Baixar modelo editável XLSX
        </a>
      </Button>
      <Button asChild variant="ghost" size={size}>
        <a href={TEMPLATE_PDF} target="_blank" rel="noreferrer">
          <FileText className="size-4" /> Ver modelo PDF
        </a>
      </Button>
    </div>
  );
}

/**
 * Bloco de apoio da importação por arquivo (Fontes de Jogos).
 * Explica o fluxo oficial: modelo → preenchimento → envio.
 */
export function TemplateImportBlock({ onPickFile }: { onPickFile?: () => void }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Importar jogos por arquivo</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Para garantir uma importação correta, utilize o modelo oficial do FotoPress. Preencha uma
        partida por linha. Depois você pode enviar o arquivo ao FotoPress — em XLSX ou exportando a
        aba <span className="font-medium">IMPORTAR_JOGOS</span> para PDF.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TemplateDownloadButtons />
        {onPickFile && (
          <Button size="sm" onClick={onPickFile}>
            <Download className="size-4 rotate-180" /> Importar arquivo
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        <li>Para melhores resultados, não altere a estrutura do modelo.</li>
        <li>Cada partida deve ocupar uma linha.</li>
        <li>Obrigatórios: DATA, HORA, MANDANTE e VISITANTE.</li>
        <li>Campeonato e temporada vêm da Fonte de Jogos, não do arquivo.</li>
      </ul>
    </section>
  );
}
