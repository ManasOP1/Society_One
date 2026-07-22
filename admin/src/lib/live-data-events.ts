/** Scoped live-data events — avoid refetching every resource on every write. */

export type LiveDataScope =
  | "members"
  | "invoices"
  | "receipts"
  | "visitors"
  | "settings"
  | "events"
  | "notices"
  | "all";

export function notifyDataUpdated(scope: LiveDataScope = "all"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("societyone-data", { detail: { scope } }));
}

function matchesScope(
  eventScope: LiveDataScope | undefined,
  listenFor: LiveDataScope | LiveDataScope[]
): boolean {
  const scopes = Array.isArray(listenFor) ? listenFor : [listenFor];
  const s = eventScope ?? "all";
  if (s === "all" || scopes.includes("all")) return true;
  return scopes.includes(s);
}

export function subscribeLiveData(
  listenFor: LiveDataScope | LiveDataScope[],
  handler: () => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const fn = (e: Event) => {
    const detail = (e as CustomEvent<{ scope?: LiveDataScope }>).detail;
    if (matchesScope(detail?.scope, listenFor)) handler();
  };
  window.addEventListener("societyone-data", fn);
  return () => window.removeEventListener("societyone-data", fn);
}
