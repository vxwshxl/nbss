import { PageSkeleton } from "@/components/shell/page-skeleton";

/**
 * Shown the instant a console link is clicked, while the new page's data is on
 * the way — and the boundary that lets Next prefetch a dynamic page at all.
 */
export default function Loading() {
  return <PageSkeleton />;
}
