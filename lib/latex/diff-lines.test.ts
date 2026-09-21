import { describe, it, expect } from "vitest";
import { diffLatexLines } from "@/lib/latex/diff-lines";

describe("diffLatexLines", () => {
  it("không có thay đổi ⇒ không có dòng nào", () => {
    const r = diffLatexLines("a\nb\nc", "a\nb\nc");
    expect(r.lines).toEqual([]);
    expect(r.additions).toBe(0);
    expect(r.deletions).toBe(0);
  });

  it("đếm đúng số dòng thêm và xoá", () => {
    const before = "\\section{A}\nnội dung A";
    const after = "\\section{A}\nnội dung A đã sửa\n\\section{B}";

    const r = diffLatexLines(before, after);
    expect(r.deletions).toBe(1); // "nội dung A"
    expect(r.additions).toBe(2); // bản sửa + section B
  });

  it("giữ lại dòng ngữ cảnh quanh thay đổi", () => {
    const before = "l1\nl2\nl3\nl4\nl5";
    const after = "l1\nl2\nl3-sua\nl4\nl5";

    const r = diffLatexLines(before, after);
    const types = r.lines.map((l) => l.type);
    expect(types).toContain("context");
    expect(r.additions).toBe(1);
    expect(r.deletions).toBe(1);
  });

  it("cắt bỏ phần không thay đổi ở xa khối thay đổi", () => {
    // 20 dòng giống nhau, chỉ dòng cuối khác ⇒ diff phải ngắn hơn 20 nhiều.
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = `${before}\nline mới`;

    const r = diffLatexLines(before, after);
    expect(r.additions).toBe(1);
    expect(r.lines.length).toBeLessThan(20);
  });

  it("mỗi dòng có id duy nhất kể cả khi nội dung trùng nhau", () => {
    const r = diffLatexLines("x", "x\nx\nx");
    const ids = r.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gán số dòng cũ cho dòng xoá và số dòng mới cho dòng thêm", () => {
    const r = diffLatexLines("a", "b");
    const removed = r.lines.find((l) => l.type === "removed");
    const added = r.lines.find((l) => l.type === "added");

    expect(removed?.oldLine).toBe(1);
    expect(removed?.newLine).toBeUndefined();
    expect(added?.newLine).toBe(1);
    expect(added?.oldLine).toBeUndefined();
  });

  it("từ rỗng sang có nội dung ⇒ toàn bộ là dòng thêm", () => {
    const r = diffLatexLines("", "a\nb");
    expect(r.deletions).toBe(1); // dòng rỗng ban đầu
    expect(r.additions).toBe(2);
  });

  it("bỏ qua diff khi đầu vào vượt ngưỡng an toàn", () => {
    // MAX_LINES = 4000; 4001 dòng phải trả về rỗng để không treo UI.
    const huge = Array.from({ length: 4001 }, (_, i) => `l${i}`).join("\n");
    const r = diffLatexLines(huge, `${huge}\nthêm`);
    expect(r.lines).toEqual([]);
    expect(r.additions).toBe(0);
  });
});
