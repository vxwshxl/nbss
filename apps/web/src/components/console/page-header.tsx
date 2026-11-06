export function PageHeader({
  title,
  action,
}: {
  title: string;
  /**
   * The section line that used to sit above the title ("Operations",
   * "Attendance"). No longer drawn: the breadcrumb already names the section,
   * and the line cost every page a row. Kept optional so call sites still compile.
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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}
