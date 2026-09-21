"use client";

import type { TemplateId } from "@/lib/types/document";
import { listTemplates, getTemplate } from "@/lib/templates/registry";

/** Gom template theo category, giữ thứ tự xuất hiện. */
function grouped() {
  const groups: { category: string; items: ReturnType<typeof listTemplates> }[] = [];
  for (const t of listTemplates()) {
    let g = groups.find((x) => x.category === t.category);
    if (!g) {
      g = { category: t.category, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

export default function TemplateSelect({
  value,
  onChange,
  disabled,
}: {
  value: TemplateId;
  onChange: (v: TemplateId) => void;
  disabled?: boolean;
}) {
  const desc = getTemplate(value)?.description ?? "";
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Dạng tài liệu (template)</span>
      <select
        aria-label="Dạng tài liệu"
        className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TemplateId)}
      >
        {grouped().map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {desc && (
        <span className="text-xs text-muted-foreground">{desc}</span>
      )}
      <span className="text-xs text-muted-foreground/70">
        💡 Hệ thống sẽ tự chọn cấu trúc LaTeX phù hợp với dạng tài liệu. Bạn không cần biết LaTeX.
      </span>
    </label>
  );
}
