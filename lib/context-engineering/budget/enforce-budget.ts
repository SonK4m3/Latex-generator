// lib/context-engineering/budget/enforce-budget.ts
//
// enforceContextBudget — trims context to fit an input-token budget.
//
// Drop policy (safest-first): low → medium → high. "critical" is NEVER dropped (global contract,
// hard constraints, output contract). Examples are "low" (safest to shed); capability guidance is
// medium/high (kept unless truly necessary). If, after shedding everything droppable, the remaining
// (critical) context still exceeds the budget, we THROW — silently truncating a compile contract
// would produce broken LaTeX, so this must surface as a configuration error instead.

import type {
  BudgetResult,
  ContextBlock,
  ContextBudget,
  ContextPriority,
  DroppedBlock,
} from "@/lib/context-engineering/types";

const DROP_ORDER: ContextPriority[] = ["low", "medium", "high"];

export function enforceContextBudget(
  blocks: ContextBlock[],
  budget: ContextBudget,
): BudgetResult {
  const available = budget.maxInputTokens - budget.reservedForOutput - budget.safetyMargin;

  const selected = [...blocks];
  const dropped: DroppedBlock[] = [];

  let total = selected.reduce((sum, block) => sum + block.estimatedTokens, 0);

  for (const priority of DROP_ORDER) {
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (total <= available) break;
      const block = selected[index];
      if (block.priority !== priority) continue;

      selected.splice(index, 1);
      total -= block.estimatedTokens;
      dropped.push({ block, reason: "budget-exceeded" });
    }
    if (total <= available) break;
  }

  if (total > available) {
    throw new Error(
      `Critical context (${total} est. tokens) exceeds the input budget (${available} available). ` +
        "Increase maxInputTokens or reduce critical block content.",
    );
  }

  return { selected, dropped, totalEstimatedTokens: total };
}
