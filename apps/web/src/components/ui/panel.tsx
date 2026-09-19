import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, type Tone } from "@/lib/ui/tones";

/**
 * A section card in the app's dashboard style: a rounded, bordered surface with
 * an optional pastel header strip (title + icon on the left, actions on the
 * right) and a padded body. Used across role dashboards and the Library.
 */
export function Panel({
  tone = "slate",
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card print:shadow-none",
        className,
      )}
    >
      {title && (
        <div className={cn("flex items-center gap-2.5 px-4 py-3 sm:px-5", t.bar)}>
          {Icon && <Icon className="size-4.5 shrink-0" strokeWidth={2} />}
          <h3 className="text-sm font-bold tracking-tight sm:text-base">{title}</h3>
          {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn("flex-1 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
