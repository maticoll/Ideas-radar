"use client";

import { useEffect, useRef } from "react";

// Infinite-scroll sentinel: calls onLoadMore when it scrolls into view.
// onLoadMore is expected to be idempotent (the feed store guards re-entrancy).
export function LoadMore({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-6">
      <button onClick={onLoadMore} className="btn text-sm" disabled={loading}>
        {loading ? "Cargando más…" : "Cargar más"}
      </button>
    </div>
  );
}
