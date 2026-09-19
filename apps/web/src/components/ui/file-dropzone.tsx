"use client";

import * as React from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_MB = 10;

/**
 * A drag-and-drop file input. Keeps a real hidden <input type="file" name=...>
 * in sync (via DataTransfer) so it posts inside a plain form action, while
 * showing a friendly dropzone + selected-file chip. Reusable app-wide.
 */
export function FileDropzone({
  name,
  accept = "image/*,application/pdf",
  maxMb = DEFAULT_MAX_MB,
  label = "Upload Document (PDF/Image)",
  hint,
  id,
  className,
  onFileChange,
}: {
  name: string;
  accept?: string;
  maxMb?: number;
  label?: string;
  hint?: string;
  id?: string;
  className?: string;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const accepts = React.useCallback(
    (f: File) => {
      if (accept === "*" || !accept) return true;
      const pats = accept.split(",").map((s) => s.trim().toLowerCase());
      const type = f.type.toLowerCase();
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      return pats.some((p) =>
        p.endsWith("/*") ? type.startsWith(p.slice(0, -1)) : p.startsWith(".") ? p === ext : p === type,
      );
    },
    [accept],
  );

  const apply = React.useCallback(
    (f: File | null) => {
      setError(null);
      if (!f) {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        onFileChange?.(null);
        return;
      }
      if (!accepts(f)) {
        setError("Unsupported file type.");
        return;
      }
      if (f.size > maxMb * 1024 * 1024) {
        setError(`File must be under ${maxMb}MB.`);
        return;
      }
      // Mirror the drop into the real input so the form submits it.
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(f);
        inputRef.current.files = dt.files;
      }
      setFile(f);
      onFileChange?.(f);
    },
    [accepts, maxMb, onFileChange],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-sm font-semibold">{label}</p>}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => apply(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => apply(null)}
            aria-label="Remove file"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            apply(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/40",
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-foreground">
            Click to upload or drag and drop
          </span>
          <span className="text-xs text-muted-foreground">{hint ?? `Max size ${maxMb}MB`}</span>
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
