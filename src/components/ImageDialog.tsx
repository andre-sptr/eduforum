import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, RotateCw, ExternalLink } from "lucide-react";

type ImageDialogProps = {
  trigger: React.ReactElement;
  fullSrc: string;
  alt: string;
  thumbSrc?: string;
  maxVH?: number;
};

export function ImageDialog({ trigger, fullSrc, alt, thumbSrc, maxVH = 80 }: ImageDialogProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const img = new Image();
    img.onload = () => setLoading(false);
    img.onerror = () => setError("Gagal memuat gambar.");
    img.src = fullSrc;
  }, [open, fullSrc]);

  const retry = () => {
    setLoading(true);
    setError(null);
    const img = new Image();
    img.onload = () => setLoading(false);
    img.onerror = () => setError("Gagal memuat gambar.");
    img.src = fullSrc + (fullSrc.includes("?") ? "&" : "?") + "ts=" + Date.now();
  };

  const dynamicHeightStyle = { maxHeight: `${maxVH}vh` };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-transparent p-0">
          <VisuallyHidden>
            <DialogPrimitive.Title>Pratinjau gambar</DialogPrimitive.Title>
            <DialogPrimitive.Description>{alt}</DialogPrimitive.Description>
          </VisuallyHidden>
          <div className="relative inline-block" style={dynamicHeightStyle}>
            {loading && !error && (
              <div className="relative">
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt=""
                    className="h-auto w-full object-contain blur-md scale-[1.02]"
                    style={dynamicHeightStyle}
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <div className="h-[50vh] w-[60vw] bg-neutral-800/40" style={dynamicHeightStyle} />
                )}
                <div className="absolute inset-0 grid place-items-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                </div>
              </div>
            )}
            {error && (
              <div className="grid place-items-center rounded-lg bg-neutral-900/70 p-6 text-center text-white">
                <p className="mb-4 text-sm opacity-90">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={retry}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
                  >
                    <RotateCw className="h-4 w-4" />
                    Coba lagi
                  </button>
                  <a
                    href={fullSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Buka gambar
                  </a>
                </div>
              </div>
            )}
            {!loading && !error && (
              <img
                src={fullSrc}
                alt={alt}
                className="h-auto w-full object-contain"
                style={dynamicHeightStyle}
                loading="eager"
                decoding="async"
              />
            )}
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Tutup"
                className="pointer-events-auto absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center
                          rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none
                          ring-1 ring-white/40"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}