"use client";

import { getDocs, onSnapshot, type Query, type QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Paged<T> {
  items: T[];
  ready: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

/**
 * First page is a live listener; older pages are one-time reads appended
 * below it. `makeQuery(cursor)` applies the page limit; the cursor is the
 * oldest document of the previous page — the last doc for newest-first
 * queries, or the first doc when `oldestFirst` (ascending + limitToLast).
 * Documents merge by id so an edit to a live-page item updates in place.
 */
export function usePagedCollection<D, T extends { id: string }>(
  makeQuery: (cursor: QueryDocumentSnapshot<D> | null) => Query<D> | null,
  pageSize: number,
  mapDoc: (snap: QueryDocumentSnapshot<D>) => T,
  sort: (a: T, b: T) => number,
  oldestFirst = false,
): Paged<T> {
  const [live, setLive] = useState<Map<string, T>>(() => new Map());
  const [older, setOlder] = useState<Map<string, T>>(() => new Map());
  const [ready, setReady] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot<D> | null>(null);
  const firstQuery = useMemo(() => makeQuery(null), [makeQuery]);

  useEffect(() => {
    if (!firstQuery) return;
    const unsub = onSnapshot(firstQuery, (snap) => {
      setLive(new Map(snap.docs.map((d) => [d.id, mapDoc(d)])));
      const edge = (oldestFirst ? snap.docs[0] : snap.docs[snap.docs.length - 1]) ?? null;
      if (!cursor.current || !snap.metadata.fromCache) cursor.current = cursor.current ?? edge;
      setReady(true);
      setHasMore((prev) => prev || snap.size >= pageSize);
    });
    return () => {
      unsub();
      cursor.current = null;
      setLive(new Map());
      setOlder(new Map());
      setReady(false);
      setHasMore(false);
    };
  }, [firstQuery, mapDoc, pageSize, oldestFirst]);

  const loadMore = useCallback(async () => {
    const q = makeQuery(cursor.current);
    if (!q || loadingMore || !hasMore || !cursor.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(q);
      setOlder((prev) => {
        const next = new Map(prev);
        snap.docs.forEach((d) => next.set(d.id, mapDoc(d)));
        return next;
      });
      cursor.current = (oldestFirst ? snap.docs[0] : snap.docs[snap.docs.length - 1]) ?? cursor.current;
      setHasMore(snap.size >= pageSize);
    } finally {
      setLoadingMore(false);
    }
  }, [makeQuery, mapDoc, pageSize, hasMore, loadingMore, oldestFirst]);

  const items = useMemo(() => {
    const merged = new Map(older);
    live.forEach((v, k) => merged.set(k, v));
    return Array.from(merged.values()).sort(sort);
  }, [live, older, sort]);

  return { items, ready, hasMore, loadingMore, loadMore };
}
