import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImageCropperDialog } from "@/components/image-cropper-dialog";
import { Label } from "@/components/ui/label";
import { uploadUserAsset } from "@/lib/storage";

/** Campo de imagem com upload do dispositivo + editor de recorte (sem URL). */
export function ImageUploadField({
  label,
  value,
  folder,
  onChange,
  round = false,
  aspect = 1,
  hint,
}: {
  label: string;
  value: string | null;
  folder: string;
  onChange: (url: string | null) => void;
  round?: boolean;
  aspect?: number;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  function reset() {
    setPending(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function save(blob: Blob) {
    setBusy(true);
    try {
      const url = await uploadUserAsset(blob, folder);
      onChange(url);
      toast.success("Imagem atualizada.");
    } catch {
      toast.error("Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
      reset();
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface ${
            round ? "size-16 rounded-full" : "h-16 w-24 rounded-lg"
          }`}
        >
          {value ? (
            <img
              src={value}
              alt={label}
              loading="lazy"
              className={round ? "size-full object-cover" : "size-full object-contain"}
            />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {value ? `Alterar ${label.toLowerCase()}` : "Fazer upload"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                <X className="size-4" /> Remover
              </Button>
            )}
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/*"
          className="hidden"
          onChange={(e) => setPending(e.target.files?.[0] ?? null)}
        />
      </div>

      <ImageCropperDialog
        file={pending}
        aspect={aspect}
        round={round}
        title={`Ajustar ${label.toLowerCase()}`}
        onCancel={reset}
        onConfirm={save}
      />
    </div>
  );
}
