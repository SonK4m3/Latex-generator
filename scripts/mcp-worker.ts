import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { processNextCompileJob } from "../lib/jobs/worker";
import { processNextPreviewJob } from "../lib/jobs/preview-worker";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.MCP_WORKER_SERVICE_ROLE_KEY;
  if (!url || !key || process.env.STORE_BACKEND !== "supabase") {
    throw new Error("Worker requires Supabase backend, URL and dedicated MCP_WORKER_SERVICE_ROLE_KEY");
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const workerId = randomUUID();
  let stopped = false;
  let nextCleanup = 0;
  process.on("SIGTERM", () => { stopped = true; });
  process.on("SIGINT", () => { stopped = true; });
  console.info(JSON.stringify({ event: "mcp.worker.started", workerId }));
  while (!stopped) {
    try {
      const worked = await processNextCompileJob(db, workerId);
      const previewWorked = process.env.MCP_PREVIEW_WORKER_ENABLED === "true" && await processNextPreviewJob(db);
      if (Date.now() >= nextCleanup) {
        nextCleanup = Date.now() + 60 * 60 * 1000;
        const { error } = await db.rpc("mcp_cleanup_expired", { p_batch_size: 100 });
        if (error) console.error(JSON.stringify({ event: "mcp.worker.cleanup_failed", workerId }));
      }
      if (!worked && !previewWorked) await delay(1000);
    } catch {
      // Do not log source, bearer credentials, or server error payloads.
      console.error(JSON.stringify({ event: "mcp.worker.iteration_failed", workerId }));
      await delay(3000);
    }
  }
}

main().catch(() => {
  console.error("MCP worker configuration/startup failed");
  process.exitCode = 1;
});
