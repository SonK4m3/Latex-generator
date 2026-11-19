"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { DocumentSummary } from "@/lib/types/document";

function snapshot(documents: DocumentSummary[]) {
  return JSON.stringify(documents.map((doc) => [doc.id, doc.updatedAt]).sort());
}

export function useLibraryUpdates(documents: DocumentSummary[] = []) {
  const [version, setVersion] = useState(0);
  const [acknowledgedVersion, setAcknowledgedVersion] = useState(0);
  const visibleSnapshot = snapshot(documents);
  const baseline = useRef(visibleSnapshot);
  useEffect(() => { baseline.current = visibleSnapshot; }, [visibleSnapshot]);

  useEffect(() => {
    let alive = true;
    let cleanup: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signalChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (alive) setVersion((value) => value + 1);
      }, 200);
    };

    // The existing projection has no event for newly inserted documents, and deleted
    // rows cannot be safely owner-filtered as Realtime DELETE messages. Probe metadata
    // while visible and leave the displayed query cache untouched until Xem mới is used.
    const abort = new AbortController();
    let probing = false;
    let lastObserved: string | undefined;
    const probe = async () => {
      if (!alive || probing || document.visibilityState !== "visible") return;
      probing = true;
      try {
        const response = await fetch("/api/documents", { cache: "no-store", signal: abort.signal });
        if (!alive || !response.ok) return;
        const result = (await response.json()) as { documents?: DocumentSummary[] };
        if (!alive || !Array.isArray(result.documents)) return;
        const next = snapshot(result.documents);
        if (next !== baseline.current && next !== lastObserved) signalChange();
        lastObserved = next;
      } catch {
        // An explicit refresh remains available if the probe fails.
      } finally {
        probing = false;
      }
    };
    const interval = setInterval(() => void probe(), 30_000);
    const onVisibility = () => void probe();
    document.addEventListener("visibilitychange", onVisibility);
    void probe();

    try {
      const client = createClient();
      void client.auth.getSession().then(async ({ data }) => {
        const session = data.session;
        if (!alive || !session) return;
        await client.realtime.setAuth(session.access_token);
        if (!alive) return;
        const signal = {
          schema: "public",
          table: "document_revision_events",
          filter: `owner_id=eq.${session.user.id}`,
        };
        const channel = client.channel(`library-revisions:${session.user.id}`)
          .on("postgres_changes", { ...signal, event: "INSERT" }, signalChange)
          .on("postgres_changes", { ...signal, event: "UPDATE" }, signalChange)
          .subscribe((status) => { if (status === "SUBSCRIBED") void probe(); });
        const { data: auth } = client.auth.onAuthStateChange((_event, next) => {
          if (next?.user.id !== session.user.id) {
            alive = false;
            abort.abort();
            if (timer) clearTimeout(timer);
            void client.removeChannel(channel);
          }
        });
        cleanup = () => {
          auth.subscription.unsubscribe();
          void client.removeChannel(channel);
        };
      }).catch(() => {});
    } catch {
      // The library still supports explicit refresh when Realtime is unavailable.
    }

    return () => {
      alive = false;
      abort.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      cleanup?.();
    };
  }, []);

  return { version, acknowledgedVersion, acknowledge: setAcknowledgedVersion };
}
