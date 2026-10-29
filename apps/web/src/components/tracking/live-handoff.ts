/**
 * Opening Live tracking on one guard from elsewhere in the console, without the guard
 * in the address: the caller leaves the id here, navigates to /console/live, and the
 * page takes it once on arrival. Session storage, so it belongs to this tab and is gone
 * the moment it is read.
 */
const KEY = "nbss:live-focus";

export function focusLiveGuard(guardId: string): void {
  try {
    sessionStorage.setItem(KEY, guardId);
  } catch {
    // Storage blocked: Live tracking opens on everyone instead.
  }
}

export function takeLiveFocus(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}
