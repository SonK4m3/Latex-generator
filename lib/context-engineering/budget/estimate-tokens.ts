// lib/context-engineering/budget/estimate-tokens.ts
//
// Level 1 token estimator — deliberately a simple heuristic (≈4 chars/token), NOT a real tokenizer.
// The doc's advice: don't start with perfect tokenization. We calibrate against the real `usage`
// the SDK returns after generation (recorded in ContextTrace.actualUsage) and can refine later
// without changing any block or selector code.

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
