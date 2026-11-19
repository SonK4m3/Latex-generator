#!/usr/bin/env node
// Local acceptance harness for docs/mcp-plugin-test-scenarios.md T04-T06.
//
// Usage:
//   node --env-file=.env.local scripts/smoke-mcp-workspace.mjs <T02_DOCUMENT_UUID>
//
// Required local environment (never printed by this script):
//   MCP_DEV_TEST_EMAIL, MCP_DEV_TEST_PASSWORD  -> Chrome login for the web editor
//   MCP_DEV_API_KEY                           -> real Bearer key for the MCP HTTP server
//
// The run mutates only the supplied T02 test document. It never creates a new
// document and never calls compile_document. Chrome runs headless.

import { chromium } from "playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const WEB_URL = "http://localhost:3001";
const MCP_URL = `${WEB_URL}/api/mcp`;

const TARGET = String.raw`TARGET\_SENTENCE: This paragraph needs improvement.`;
const REPLACEMENT = String.raw`TARGET\_SENTENCE: This paragraph is now clear and concise.`;
const KEEP_ALPHA = String.raw`KEEP\_UNCHANGED: Alpha 123.`;
const KEEP_BETA = String.raw`KEEP\_UNCHANGED: Beta 456.`;
const WEB_EDIT = String.raw`WEB\_EDIT: Updated in the browser.`;
const AI_FOLLOWUP = String.raw`AI\_FOLLOWUP: Read the latest revision first.`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXTAREA = 'textarea[aria-label="Mã LaTeX"]';

const verdicts = [];
let secretValues = [];

function record(id, status, detail) {
  verdicts.push({ id, status });
  console.log(`[${id}] ${status}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function norm(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

function redact(error) {
  let text = error instanceof Error ? error.message : String(error ?? "unknown error");
  for (const secret of secretValues) {
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.replace(/\s+/g, " ").slice(0, 800);
}

function readConfig() {
  const documentId = (process.argv[2] ?? "").trim();
  if (!UUID_RE.test(documentId)) {
    throw new Error("Usage: node scripts/smoke-mcp-workspace.mjs <T02_DOCUMENT_UUID> (a UUID)");
  }
  const email = process.env.MCP_DEV_TEST_EMAIL?.trim();
  const password = process.env.MCP_DEV_TEST_PASSWORD;
  const apiKey = process.env.MCP_DEV_API_KEY?.trim();
  for (const [name, value] of [
    ["MCP_DEV_TEST_EMAIL", email],
    ["MCP_DEV_TEST_PASSWORD", password],
    ["MCP_DEV_API_KEY", apiKey],
  ]) {
    if (!value) throw new Error(`${name} is required in the local environment.`);
  }
  secretValues = [email, password, apiKey];
  return { documentId, email, password, apiKey };
}

async function launchChrome() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    // Keep the harness runnable on hosts where the chrome channel is absent.
    console.warn("[browser] Chrome channel unavailable; using bundled headless Chromium.");
    return chromium.launch({ headless: true });
  }
}

async function connectMcp(apiKey) {
  const client = new Client(
    { name: "smoke-mcp-workspace", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  await client.connect(transport);
  return client;
}

async function callTool(client, name, args) {
  const response = await client.callTool({ name, arguments: args });
  if (response.isError) {
    const code = response._meta?.code ?? response.structuredContent?.code ?? "tool_error";
    throw new Error(`${name} failed with code ${code}.`);
  }
  if (!response.structuredContent) throw new Error(`${name} returned no structuredContent.`);
  return response.structuredContent;
}

async function login(page, email, password, documentId) {
  const redirectTo = `/documents/${documentId}`;
  await page.goto(`${WEB_URL}/login`);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000 });
  await page.goto(`${WEB_URL}${redirectTo}`);
}

async function openSourceTab(page) {
  await page.getByRole("button", { name: "LaTeX", exact: true }).click();
  const textarea = page.getByRole("textbox", { name: "Mã LaTeX" });
  await textarea.waitFor({ state: "visible", timeout: 30_000 });
  return textarea;
}

async function caseT04({ page, client, documentId, documentUrl }) {
  const textarea = await openSourceTab(page);

  const heading = norm(await page.locator("h1").first().textContent());
  assert(heading.startsWith("MCP workspace smoke") || heading.startsWith("MCP E2E"), "Expected a dedicated MCP test document.");

  const baseline = await callTool(client, "get_document", { documentId, includeSource: true });
  assert(baseline.document?.documentId === documentId, "get_document returned another document.");
  assert(baseline.document.isProject === false, "T04 expects the single-file T02 baseline document.");
  assert(typeof baseline.source?.latex === "string" && baseline.source.latex.length > 0, "MCP returned no LaTeX source.");
  const source = baseline.source.latex;

  assert(countOccurrences(source, TARGET) === 1, "TARGET_SENTENCE is missing or not unique in the saved source.");
  assert(countOccurrences(source, KEEP_ALPHA) === 1, "KEEP_UNCHANGED Alpha marker is missing or not unique.");
  assert(countOccurrences(source, KEEP_BETA) === 1, "KEEP_UNCHANGED Beta marker is missing or not unique.");

  const uiSource = await textarea.inputValue();
  assert(uiSource === source, "Browser source differs from the MCP baseline; a fresh copy context is required.");

  const range = await page.evaluate(({ marker }) => {
    const node = document.querySelector('textarea[aria-label="Mã LaTeX"]');
    if (!node) throw new Error("LaTeX textarea not found.");
    const start = node.value.indexOf(marker);
    if (start < 0) throw new Error("Marker not found in the textarea.");
    if (node.value.indexOf(marker, start + marker.length) !== -1) throw new Error("Marker is not unique.");
    node.focus();
    node.setSelectionRange(start, start);
    return { start, end: start + marker.length };
  }, { marker: TARGET });

  await textarea.press("Shift+End");

  const copyButton = page.getByRole("button", { name: /Copy context/i });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((item) =>
      /Copy context/i.test(item.textContent ?? ""));
    return Boolean(button && !button.disabled);
  }, undefined, { timeout: 15_000 });

  await page.bringToFront();
  await copyButton.click();
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((item) =>
      /Copy context/i.test(item.textContent ?? ""));
    return Boolean(button && /Đã copy context/i.test(button.textContent ?? ""));
  }, undefined, { timeout: 5000 });

  const selection = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert(selection.schemaVersion === 1, "Clipboard context has an unexpected schemaVersion.");
  assert(selection.documentId === documentId, "Clipboard context belongs to another document.");
  assert(selection.filePath === "main.tex", `Clipboard context filePath is ${selection.filePath}.`);
  assert(selection.start === range.start && selection.end === range.end, "Clipboard context offsets do not match the selection.");
  assert(selection.selectedText === TARGET, "Clipboard context selectedText is not the exact target sentence.");
  assert(selection.updatedAt === baseline.document.updatedAt, "Clipboard context revision is stale.");
  assert(selection.prefix === source.slice(Math.max(0, range.start - 256), range.start), "Clipboard prefix anchor mismatch.");
  assert(selection.suffix === source.slice(range.end, range.end + 256), "Clipboard suffix anchor mismatch.");

  await page.evaluate(() => { window.__smokeNoReload = "alive"; });
  const startedAt = Date.now();
  const saved = await callTool(client, "edit_document_selection", { selection, replacement: REPLACEMENT });
  assert(saved.documentId === documentId, "edit_document_selection changed the document id.");
  assert(saved.filePath === "main.tex", `edit_document_selection wrote ${saved.filePath}.`);
  assert(saved.changedRange?.start === range.start, "changedRange.start does not match the selection.");
  assert(saved.changedRange?.end === range.start + REPLACEMENT.length, "changedRange.end does not match the replacement.");
  assert(typeof saved.updatedAt === "string" && saved.updatedAt.length > 0, "edit_document_selection returned no updatedAt.");

  const expectedSource = source.slice(0, range.start) + REPLACEMENT + source.slice(range.end);

  await page.waitForFunction(({ expected, alpha, beta }) => {
    const node = document.querySelector('textarea[aria-label="Mã LaTeX"]');
    return Boolean(node && node.value === expected && node.value.includes(alpha) && node.value.includes(beta));
  }, { expected: expectedSource, alpha: KEEP_ALPHA, beta: KEEP_BETA }, { timeout: 30_000 });
  const latencyMs = Date.now() - startedAt;
  await page.getByText(/^(Mã nguồn đã cập nhật · cần biên dịch|Đã nhận bản cập nhật)$/).waitFor();
  const historyButton = page.getByRole("button", { name: /^(Lịch sử|Cập nhật trong phiên)$/ });
  await historyButton.click();
  await page.locator("#document-update-history li").filter({ hasText: "Nhận cập nhật lúc" }).first().waitFor();
  await historyButton.click();

  const noReload = await page.evaluate(() => window.__smokeNoReload === "alive");
  assert(noReload, "The web editor reloaded instead of applying the realtime revision.");
  assert(page.url() === documentUrl, `The browser left the document: ${page.url()}`);

  const after = await callTool(client, "get_document", { documentId, includeSource: true });
  assert(after.document?.documentId === documentId, "Post-edit get_document returned another document.");
  assert(after.source?.latex === expectedSource, "Saved source is not the exact single-span replacement.");
  assert(countOccurrences(after.source.latex, KEEP_ALPHA) === 1 && countOccurrences(after.source.latex, KEEP_BETA) === 1,
    "An untouched marker was changed by the selection edit.");
  assert(after.document.updatedAt === saved.updatedAt, "Saved revision does not match the edit result.");

  return { start: range.start, end: saved.changedRange.end, updatedAt: saved.updatedAt, latencyMs };
}

async function caseT05({ page, client, documentId }) {
  const compileButton = page.getByRole("button", { name: "Biên dịch", exact: true });
  const responsePromise = page.waitForResponse((response) => {
    try {
      return new URL(response.url()).pathname === `/api/documents/${documentId}` &&
        response.request().method() === "PATCH";
    } catch {
      return false;
    }
  }, { timeout: 180_000 });

  await compileButton.click();
  const response = await responsePromise;
  const compiled = await response.json();
  assert(response.ok(), `Web compile failed with HTTP ${response.status()}${compiled?.error ? `: ${compiled.error}` : ""}.`);
  assert(compiled.id === documentId, "Web compile saved a different document.");
  assert(!compiled.error, `Web compile reported: ${compiled.error}`);
  assert(typeof compiled.pdfBase64 === "string" && compiled.pdfBase64.length > 0, "Web compile returned no PDF.");

  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator('section[aria-label="Xem trước PDF"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Xem trước PDF"] canvas')]
    .some((canvas) => canvas.width > 0 && canvas.getBoundingClientRect().height > 0), undefined, { timeout: 30_000 });

  const task = getDocument({ data: Uint8Array.from(Buffer.from(compiled.pdfBase64, "base64")) });
  let pages;
  let pdfText;
  try {
    const pdf = await task.promise;
    pages = pdf.numPages;
    const text = [];
    for (let number = 1; number <= pages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      text.push(content.items.map((item) => "str" in item ? item.str : "").join(""));
    }
    pdfText = norm(text.join(" "));
  } finally {
    await task.destroy();
  }
  const rendered = (source) => norm(source.replaceAll("\\_", "_"));
  assert(pages === 2, `Compiled PDF has ${pages} page(s), expected 2.`);
  assert(pdfText.includes(rendered(REPLACEMENT)), "Compiled PDF does not contain the T04 replacement.");
  assert(!pdfText.includes(rendered(TARGET)), "Compiled PDF still contains the old target sentence.");
  assert(pdfText.includes(rendered(KEEP_ALPHA)), "Compiled PDF lost the Alpha marker.");
  assert(pdfText.includes(rendered(KEEP_BETA)), "Compiled PDF lost the Beta marker.");

  const document = await callTool(client, "get_document", { documentId, includeSource: false });
  assert(document.document?.documentId === documentId, "Compile verification read another document.");
  assert(document.document.hasPdf === true, "get_document does not report a PDF after the web compile.");

  return { pages, updatedAt: compiled.updatedAt, pdfBytes: Buffer.from(compiled.pdfBase64, "base64").length };
}

async function caseT06({ page, client, documentId }) {
  const textarea = await openSourceTab(page);
  const before = await callTool(client, "get_document", { documentId, includeSource: true });
  assert(typeof before.source?.latex === "string", "MCP returned no source before the web edit.");
  assert(countOccurrences(before.source.latex, KEEP_BETA) === 1, "The Conclusion marker is missing or not unique.");

  const webEdited = before.source.latex.replace(KEEP_BETA, WEB_EDIT);
  const savePromise = page.waitForResponse((response) => {
    try {
      return new URL(response.url()).pathname === `/api/documents/${documentId}` &&
        response.request().method() === "PATCH";
    } catch {
      return false;
    }
  }, { timeout: 30_000 });

  await textarea.fill(webEdited);
  const saveResponse = await savePromise;
  const saved = await saveResponse.json();
  assert(saveResponse.ok(), `Manual web save failed with HTTP ${saveResponse.status()}.`);
  assert(saved.id === documentId && saved.latex === webEdited, "Manual web save did not persist the edited source.");
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')]
    .some((node) => (node.textContent ?? "").trim() === "Đã lưu"), undefined, { timeout: 15_000 });

  const read = await callTool(client, "get_document", { documentId, includeSource: true });
  assert(read.document?.documentId === documentId, "Post-save get_document returned another document.");
  assert(typeof read.source?.latex === "string", "Post-save get_document returned no source.");
  assert(read.source.latex.includes(WEB_EDIT), "MCP did not read the manual WEB_EDIT sentence.");
  assert(countOccurrences(read.source.latex, WEB_EDIT) === 1, "WEB_EDIT is missing or not unique in the MCP read.");
  assert(typeof read.document.updatedAt === "string" && read.document.updatedAt.length > 0, "MCP read returned no revision.");

  const finalSource = read.source.latex.replace(WEB_EDIT, `${WEB_EDIT} ${AI_FOLLOWUP}`);
  const updated = await callTool(client, "update_document_source", {
    documentId,
    expectedUpdatedAt: read.document.updatedAt,
    latex: finalSource,
  });
  assert(updated.documentId === documentId, "update_document_source changed the document id.");
  assert(typeof updated.updatedAt === "string" && updated.updatedAt.length > 0, "update_document_source returned no updatedAt.");
  assert(String(updated.webUrl).includes(documentId), "update_document_source returned another webUrl.");

  const finalRead = await callTool(client, "get_document", { documentId, includeSource: true });
  assert(finalRead.document?.documentId === documentId, "Final get_document returned another document.");
  assert(finalRead.source?.latex === finalSource, "CAS update did not persist exactly the expected source.");
  assert(finalRead.document.updatedAt === updated.updatedAt, "CAS update revision differs from the final read.");
  const webEditAt = finalSource.indexOf(WEB_EDIT);
  const followupAt = finalSource.indexOf(AI_FOLLOWUP);
  assert(followupAt === webEditAt + WEB_EDIT.length + 1, "AI_FOLLOWUP is not immediately after WEB_EDIT.");

  await page.waitForFunction(({ expected }) => {
    const node = document.querySelector('textarea[aria-label="Mã LaTeX"]');
    return Boolean(node && node.value === expected);
  }, { expected: finalSource }, { timeout: 30_000 });
  assert(await page.evaluate(() => window.__smokeNoReload === "alive"), "The web editor reloaded during the CAS update.");
  assert(page.url() === `${WEB_URL}/documents/${documentId}`, "The browser left the test document.");

  return { readUpdatedAt: read.document.updatedAt, updatedAt: updated.updatedAt };
}

async function main() {
  let config;
  try {
    config = readConfig();
  } catch (error) {
    console.error(redact(error));
    process.exitCode = 2;
    return;
  }
  const { documentId, email, password, apiKey } = config;
  const documentUrl = `${WEB_URL}/documents/${documentId}`;
  console.log(`[setup] T02 document ${documentId}; web ${WEB_URL}; MCP ${MCP_URL}`);

  let browser;
  let client;
  try {
    browser = await launchChrome();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WEB_URL });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    await login(page, email, password, documentId);
    client = await connectMcp(apiKey);

    let t04;
    try {
      t04 = await caseT04({ page, client, documentId, documentUrl });
      record("T04", "PASS", `same ${documentId}, range ${t04.start}-${t04.end}, realtime ${t04.latencyMs}ms, no reload`);
    } catch (error) {
      record("T04", "FAIL", redact(error));
      record("T05", "NOT RUN");
      record("T06", "NOT RUN");
      process.exitCode = 1;
      return;
    }

    try {
      const t05 = await caseT05({ page, client, documentId });
      record("T05", "PASS", `same ${documentId}, PDF ${t05.pages} pages/${t05.pdfBytes} bytes contains replacement + both markers`);
    } catch (error) {
      record("T05", "FAIL", redact(error));
      process.exitCode = 1;
    }

    try {
      const t06 = await caseT06({ page, client, documentId });
      record("T06", "PASS", `read ${t06.readUpdatedAt}, CAS ${t06.updatedAt}, browser has WEB_EDIT + AI_FOLLOWUP`);
    } catch (error) {
      record("T06", "FAIL", redact(error));
      process.exitCode = 1;
    }
  } catch (error) {
    record("T04", "NOT RUN", `setup failed: ${redact(error)}`);
    record("T05", "NOT RUN");
    record("T06", "NOT RUN");
    process.exitCode = 1;
  } finally {
    if (client) await client.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main()
  .then(() => {
    const failed = verdicts.length === 0 || verdicts.some(({ status }) => status !== "PASS");
    console.log(failed ? "RESULT: FAIL" : "RESULT: PASS");
  })
  .catch((error) => {
    console.error(`[harness] ${redact(error)}`);
    console.log("RESULT: FAIL");
    process.exitCode = 1;
  });
