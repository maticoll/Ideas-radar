"use client";

// Shared, cursor-paginated client store for the opportunity feed.
//
// One module-level store per feed key ("all" | "saved"), so navigating
// dashboard -> history (both the "all" feed) reuses already-fetched pages
// instead of re-hitting /api/ideas/history (the double-fetch we wanted to kill).
// A short staleness window triggers a background refresh of the first page so
// saved-state changes still show up.

import { useCallback, useEffect, useReducer } from "react";
import type { Idea } from "./idea";

interface FeedStore {
  ideas: Idea[];
  nextCursor: string | null;
  loaded: boolean;
  loadingInitial: boolean;
  loadingMore: boolean;
  lastLoadedAt: number;
  inFlight: Promise<void> | null;
}

const PAGE = 24;
const STALE_MS = 30_000;

const stores: Record<string, FeedStore> = {};
const listeners: Record<string, Set<() => void>> = {};

function keyFor(saved: boolean): string {
  return saved ? "saved" : "all";
}

function getStore(key: string): FeedStore {
  if (!stores[key]) {
    stores[key] = {
      ideas: [],
      nextCursor: null,
      loaded: false,
      loadingInitial: false,
      loadingMore: false,
      lastLoadedAt: 0,
      inFlight: null,
    };
  }
  return stores[key];
}

function emit(key: string) {
  listeners[key]?.forEach((l) => l());
}

function patch(key: string, p: Partial<FeedStore>) {
  Object.assign(getStore(key), p);
  emit(key);
}

function buildUrl(saved: boolean, cursor: string | null): string {
  const q = new URLSearchParams({ take: String(PAGE) });
  if (saved) q.set("saved", "true");
  if (cursor) q.set("cursor", cursor);
  return `/api/ideas/history?${q.toString()}`;
}

async function fetchPage(saved: boolean, cursor: string | null): Promise<{ ideas: Idea[]; nextCursor: string | null }> {
  try {
    const res = await fetch(buildUrl(saved, cursor));
    if (!res.ok) return { ideas: [], nextCursor: null };
    const d = await res.json();
    return { ideas: d.ideas ?? [], nextCursor: d.nextCursor ?? null };
  } catch {
    return { ideas: [], nextCursor: null };
  }
}

function ensureLoaded(saved: boolean) {
  const key = keyFor(saved);
  const s = getStore(key);
  const fresh = s.loaded && Date.now() - s.lastLoadedAt < STALE_MS;
  if (s.inFlight || fresh) return;
  patch(key, { loadingInitial: s.ideas.length === 0 });
  const run = (async () => {
    const { ideas, nextCursor } = await fetchPage(saved, null);
    patch(key, { ideas, nextCursor, loaded: true, loadingInitial: false, lastLoadedAt: Date.now() });
  })();
  s.inFlight = run;
  void run.finally(() => {
    s.inFlight = null;
  });
}

function loadMore(saved: boolean) {
  const key = keyFor(saved);
  const s = getStore(key);
  if (s.inFlight || !s.loaded || s.nextCursor == null) return;
  patch(key, { loadingMore: true });
  const cursor = s.nextCursor;
  const run = (async () => {
    const { ideas, nextCursor } = await fetchPage(saved, cursor);
    patch(key, { ideas: [...getStore(key).ideas, ...ideas], nextCursor, loadingMore: false });
  })();
  s.inFlight = run;
  void run.finally(() => {
    s.inFlight = null;
  });
}

function reload(saved: boolean) {
  const key = keyFor(saved);
  const s = getStore(key);
  s.inFlight = null; // force a refetch even if one was in flight
  const run = (async () => {
    const { ideas, nextCursor } = await fetchPage(saved, null);
    patch(key, { ideas, nextCursor, loaded: true, loadingInitial: false, lastLoadedAt: Date.now() });
  })();
  s.inFlight = run;
  void run.finally(() => {
    s.inFlight = null;
  });
}

export function useIdeasFeed(saved = false) {
  const key = keyFor(saved);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    (listeners[key] ??= new Set()).add(force);
    return () => {
      listeners[key]?.delete(force);
    };
  }, [key]);

  useEffect(() => {
    ensureLoaded(saved);
  }, [saved, key]);

  const s = getStore(key);
  return {
    ideas: s.ideas,
    hasMore: s.nextCursor != null,
    loadingInitial: s.loadingInitial && s.ideas.length === 0,
    loadingMore: s.loadingMore,
    loaded: s.loaded,
    loadMore: useCallback(() => loadMore(saved), [saved]),
    reload: useCallback(() => reload(saved), [saved]),
  };
}
