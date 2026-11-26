export interface SourceSelectionContext {
  schemaVersion: 1;
  documentId: string;
  updatedAt: string;
  filePath: string;
  start: number;
  end: number;
  selectedText: string;
  prefix: string;
  suffix: string;
}

export interface SourceSelectionSnapshot {
  start: number;
  end: number;
  source: string;
  updatedAt: string;
}

const ANCHOR_LENGTH = 256;

export function createSourceSelectionContext(input: {
  documentId: string;
  updatedAt: string;
  filePath: string;
  source: string;
  selection: SourceSelectionSnapshot;
}): SourceSelectionContext | null {
  const { source, updatedAt, selection } = input;
  const { start, end } = selection;
  if (selection.updatedAt !== updatedAt || selection.source !== source) return null;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > source.length) {
    return null;
  }
  return {
    schemaVersion: 1,
    documentId: input.documentId,
    updatedAt: input.updatedAt,
    filePath: input.filePath,
    start,
    end,
    selectedText: source.slice(start, end),
    prefix: source.slice(Math.max(0, start - ANCHOR_LENGTH), start),
    suffix: source.slice(end, Math.min(source.length, end + ANCHOR_LENGTH)),
  };
}

export async function copySourceSelectionContext(context: SourceSelectionContext): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(context, null, 2));
}
