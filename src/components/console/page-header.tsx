export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  /**
   * Small capitalised line above the title — the section this screen belongs
   * to, where the title alone is ambiguous ("Invoices" under FEE COLLECTIONS,
   * "Invoices" under BILLING). Optional: the shell's breadcrumb already carries
   * this, so only reach for it where the page genuinely reads better with it.
   */
  eyebrow?: string;
  /**
   * Descriptions are intentionally not rendered — the title alone is enough
   * context and the subtitle only cost vertical space. The prop is kept
   * optional so existing call sites keep type-checking; it is simply ignored.
   */
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}
