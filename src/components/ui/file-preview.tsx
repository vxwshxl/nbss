"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FileKind = "image" | "pdf" | "other";

function extKind(s: string): FileKind | null {
  const t = s.toLowerCase().split("?")[0] ?? "";
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(t)) return "image";
  if (/\.pdf$/.test(t)) return "pdf";
  return null;
}

// Detect from the name first, else the URL — R2 links carry the real extension
// even when the display name doesn't.
function fileKind(url: string, name: string): FileKind {
  return extKind(name) ?? extKind(url) ?? "other";
}

/**
 * A click-to-preview wrapper for an uploaded file (R2 URL). Images render at a
 * responsive size and PDFs embed inline — both inside a dialog, so nothing opens
 * a raw storage link in a new tab. Anything else offers a download. `children`
 * is the visible trigger (a chip, a link, etc.).
 */
export function FilePreview({
  url,
  name,
  className,
  children,
}: {
  url: string;
  name?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = name ?? "Attachment";
  const kind = fileKind(url, label);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-app-line-soft px-5 py-4 pr-14">
            <DialogTitle className="truncate text-sm">{label}</DialogTitle>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Download className="size-3.5" /> Download
            </a>
          </DialogHeader>
          <div
            className={cn(
              "flex items-center justify-center overflow-auto bg-muted/30",
              kind === "image" ? "p-4" : "p-0",
            )}
          >
            {kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={label}
                className="mx-auto max-h-[74vh] w-auto max-w-full rounded-md object-contain"
              />
            ) : kind === "pdf" ? (
              <iframe src={url} title={label} className="h-[74vh] w-full border-0" />
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <FileText className="size-8 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  This file can&apos;t be previewed here.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent press"
                >
                  <Download className="size-4" /> Download {label}
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
