/**
 * The flat, icon-free view of a console's navigation.
 *
 * Deliberately strings only: this crosses the server/client boundary as a prop
 * from each layout to {@link import("./app-shell").AppShell}, and a lucide icon
 * is a function component, which does not serialise. The nav components keep
 * their own icon-bearing definitions and derive this from them, so there is one
 * list to edit rather than two that drift.
 */
export type NavIndexItem = {
  href: string;
  label: string;
  /** Section this item sits under, used as the middle breadcrumb. */
  group?: string;
  /** Match this href exactly — for a parent path that is also a real page. */
  exact?: boolean;
};

/** Does `pathname` sit on, or inside, this nav item? */
export function navItemMatches(item: NavIndexItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * The deepest nav item that owns `pathname`.
 *
 * "Deepest" is by href length, so `/fees/invoices` wins over `/fees` on
 * `/fees/invoices/abc123`. The console root (`/dashboard`, `/admin`, `/partner`)
 * is excluded from prefix matching: it is a page that happens to sit at the
 * root, not a section above every other one, and without this every page absent
 * from the nav would inherit it and read "SchoolERP › Dashboard › …".
 */
export function findNavItem(
  index: NavIndexItem[],
  pathname: string,
  rootHref?: string,
): NavIndexItem | null {
  let best: NavIndexItem | null = null;
  for (const item of index) {
    const isRoot = item.href === rootHref;
    const hit = isRoot ? pathname === item.href : navItemMatches(item, pathname);
    if (!hit) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}
