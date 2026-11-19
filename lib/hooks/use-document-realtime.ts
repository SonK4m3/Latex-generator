"use client";

import { useEffect, useRef } from "react";
import type { StoredDocument } from "@/lib/types/document";
import { createClient } from "@/utils/supabase/client";

/**
 * Workspace projection of a document. The API adds revision metadata so the UI can tell whether
 * the stored PDF still matches the source without transferring the PDF bytes on every realtime tick.
 */
export type WorkspaceDocument = StoredDocument & {
  sourceRevision?: string;
  pdfSourceRevision?: string;
  hasPdf?: boolean;
};

export function compareRevisionTimestamps(left: string, right: string): number {
  const toMicros = (value: string): bigint | null => {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/,
    );
    if (!match) return null;
    const [, y, mo, d, h, mi, s, fraction = "", zone] = match;
    const epochSeconds = Math.floor(
      Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) / 1000,
    );
    const offset = zone === "Z" ? 0 : (zone[0] === "+" ? 1 : -1) *
      (+zone.slice(1, 3) * 60 + +zone.slice(4, 6));
    const micros = BigInt((fraction + "000000").slice(0, 6));
    return BigInt(epochSeconds - offset * 60) * BigInt(1_000_000) + micros;
  };
  const a = toMicros(left);
  const b = toMicros(right);
  if (a !== null && b !== null) return a < b ? -1 : a > b ? 1 : 0;
  return Date.parse(left) - Date.parse(right);
}

export function useDocumentRealtime(
  documentId: string | undefined,
  onDocument: (document: WorkspaceDocument | null) => void,
) {
  const callback = useRef(onDocument);
  useEffect(() => {
    callback.current = onDocument;
  }, [onDocument]);

  useEffect(() => {
    if (!documentId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | undefined;
    let client: ReturnType<typeof createClient> | undefined;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!active) return;
        try {
          // Metadata-only workspace read: never pull PDF bytes through the realtime path. The
          // viewer loads them from the authenticated /pdf endpoint on demand.
          const response = await fetch(`/api/documents/${documentId}?view=workspace`, {
            cache: "no-store",
            credentials: "same-origin",
            headers: { accept: "application/json" },
          });
          if (!active) return;
          if (response.status === 404) {
            callback.current(null);
          } else if (response.ok) {
            const document = (await response.json()) as WorkspaceDocument;
            if (active) callback.current(document);
          }
        } catch {
          // A later event or channel reconnect will retry the refresh.
        }
      }, 250);
    };

    try {
      const supabase = createClient();
      client = supabase;
      void supabase.auth.getSession().then(async ({ data }) => {
        if (!active || !data.session) return;
        await supabase.realtime.setAuth(data.session.access_token);
        if (!active) return;
        channel = supabase
          .channel(`document-revisions:${documentId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "document_revision_events",
              filter: `document_id=eq.${documentId}`,
            },
            scheduleRefresh,
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "document_revision_events",
              filter: `document_id=eq.${documentId}`,
            },
            scheduleRefresh,
          )
          .subscribe((status) => {
            if (active && status === "SUBSCRIBED") scheduleRefresh();
          });
      }).catch(() => {
        // Realtime is optional when auth or network initialization is unavailable.
      });
    } catch {
      // Invalid or missing browser Supabase configuration leaves polling disabled.
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (channel) void client?.removeChannel(channel);
    };
  }, [documentId]);
}
