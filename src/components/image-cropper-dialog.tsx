import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const BOX = 288;

/** Editor de imagem: zoom, mover, enquadrar e recortar antes do envio. */
export function ImageCropperDialog({
  file,
  aspect = 1,
  round = false,
  title = "Ajustar imagem",
  onCancel,
  onConfirm,
}: {
  file: File | null;
  aspect?: number;
  round?: boolean;
  title?: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const boxW = BOX;
  const boxH = Math.round(BOX / aspect);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = image ? Math.max(boxW / image.naturalWidth, boxH / image.naturalHeight) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (next: { x: number; y: number }) => {
      if (!image) return next;
      const dw = image.naturalWidth * scale;
      const dh = image.naturalHeight * scale;
      const mx = Math.max(0, (dw - boxW) / 2);
      const my = Math.max(0, (dh - boxH) / 2);
      return {
        x: Math.min(mx, Math.max(-mx, next.x)),
        y: Math.min(my, Math.max(-my, next.y)),
      };
    },
    [image, scale, boxW, boxH],
  );

  useEffect(() => {
    setOffset((o) => clamp(o));
  }, [clamp]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function confirm() {
    if (!image) return;
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const lx = boxW / 2 + offset.x - dw / 2;
    const ly = boxH / 2 + offset.y - dh / 2;
    const sx = -lx / scale;
    const sy = -ly / scale;
    const sw = boxW / scale;
    const sh = boxH / scale;

    const outW = Math.min(768, Math.round(sw));
    const outH = Math.round(outW / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, outW);
    canvas.height = Math.max(1, outH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && onConfirm(blob), "image/webp", 0.9);
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Arraste para mover e use o zoom para enquadrar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className={`relative touch-none overflow-hidden border border-border bg-surface ${
              round ? "rounded-full" : "rounded-lg"
            }`}
            style={{ width: boxW, height: boxH, maxWidth: "100%" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {src && image && (
              <img
                src={src}
                alt="Pré-visualização"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none cursor-grab select-none active:cursor-grabbing"
                style={{
                  width: image.naturalWidth * scale,
                  height: image.naturalHeight * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.01}
              onValueChange={([v]) => setZoom(v ?? 1)}
            />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={!image}>
            Salvar imagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
