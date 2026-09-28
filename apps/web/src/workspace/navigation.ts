import { readRoute, routeHash } from "./routes";
import type { ToolRoute } from "./routes";

interface Entry {
  readonly owner: "pdfburrow";
  readonly index: number;
  readonly route: ToolRoute;
}

export interface NavigationGuard {
  readonly hasWork: boolean;
  readonly locked: boolean;
  readonly discard: () => void;
}

interface NavigationCallbacks {
  readonly guard: () => NavigationGuard;
  readonly change: (route: ToolRoute) => void;
  readonly confirm: (open: boolean) => void;
  readonly blocked: () => void;
}

const entryIndex = (state: unknown): number | undefined =>
  typeof state === "object" &&
  state !== null &&
  "owner" in state &&
  state.owner === "pdfburrow" &&
  "index" in state &&
  typeof state.index === "number" &&
  Number.isSafeInteger(state.index)
    ? state.index
    : undefined;

export const createNavigation = (callbacks: NavigationCallbacks) => {
  let current: Entry = {
    owner: "pdfburrow",
    index: entryIndex(history.state) ?? 0,
    route: readRoute(location.hash),
  };
  let pending: { kind: "push" | "pop"; entry: Entry } | null = null;
  let restoring = false;
  let replay: Entry | null = null;
  const write = (entry: Entry, replace: boolean) => {
    const url = `${location.pathname}${routeHash(entry.route)}`;
    if (replace) {
      history.replaceState(entry, "", url);
    } else {
      history.pushState(entry, "", url);
    }
  };
  write(current, true);

  const accept = (entry: Entry, discard: boolean) => {
    if (discard) {
      callbacks.guard().discard();
    }
    current = entry;
    callbacks.change(entry.route);
  };
  const request = (route: ToolRoute) => {
    if (restoring || pending || replay || route === current.route) {
      return;
    }
    const guard = callbacks.guard();
    if (guard.locked) {
      callbacks.blocked();
      return;
    }
    const entry: Entry = { owner: "pdfburrow", index: current.index + 1, route };
    if (guard.hasWork) {
      pending = { kind: "push", entry };
      callbacks.confirm(true);
    } else {
      write(entry, false);
      accept(entry, false);
    }
  };
  const pop = () => {
    const knownIndex = entryIndex(history.state);
    const entry: Entry = {
      owner: "pdfburrow",
      index: knownIndex ?? current.index + 1,
      route: readRoute(location.hash),
    };
    // A manually edited hash creates a history entry without our state.
    if (knownIndex === undefined) {
      write(entry, true);
    }
    if (restoring) {
      if (entry.index !== current.index) {
        history.go(current.index - entry.index);
        return;
      }
      restoring = false;
      if (pending) {
        callbacks.confirm(true);
      }
      return;
    }
    if (replay?.index === entry.index) {
      replay = null;
      accept(entry, true);
      return;
    }
    if (entry.index === current.index && entry.route === current.route) {
      return;
    }
    if (entry.route === current.route) {
      accept(entry, false);
      return;
    }
    const guard = callbacks.guard();
    if (!guard.locked && !guard.hasWork && !pending) {
      accept(entry, false);
      return;
    }
    const delta = current.index - entry.index;
    if (delta === 0) {
      write(current, true);
      if (!guard.locked && !pending) {
        pending = { kind: "push", entry: { ...entry, index: current.index + 1 } };
        callbacks.confirm(true);
      }
    } else {
      restoring = true;
      if (!guard.locked && !pending) {
        pending = { kind: "pop", entry };
      }
      history.go(delta);
    }
    if (guard.locked) {
      callbacks.blocked();
    }
  };
  window.addEventListener("popstate", pop);
  return {
    request,
    keep: () => {
      pending = null;
      callbacks.confirm(false);
    },
    discard: () => {
      if (!pending || restoring || callbacks.guard().locked) {
        return;
      }
      const target = pending;
      pending = null;
      callbacks.confirm(false);
      if (target.kind === "push") {
        write(target.entry, false);
        accept(target.entry, true);
      } else {
        replay = target.entry;
        history.go(target.entry.index - current.index);
      }
    },
    dispose: () => window.removeEventListener("popstate", pop),
  };
};
