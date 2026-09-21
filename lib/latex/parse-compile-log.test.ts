import { describe, it, expect } from "vitest";
import { parseCompileLogErrorLines } from "@/lib/latex/parse-compile-log";

describe("parseCompileLogErrorLines", () => {
  it("trả về mảng rỗng khi không có log", () => {
    expect(parseCompileLogErrorLines()).toEqual([]);
    expect(parseCompileLogErrorLines("")).toEqual([]);
  });

  it("trả về mảng rỗng khi log không chứa dạng lỗi nào", () => {
    expect(
      parseCompileLogErrorLines("Tectonic 0.15.0\nRunning TeX ...\nDone."),
    ).toEqual([]);
  });

  it("bắt dạng file:line:", () => {
    const log = "./main.tex:42: Undefined control sequence";
    expect(parseCompileLogErrorLines(log)).toEqual([42]);
  });

  it("bắt dạng file:line: không có tiền tố ./", () => {
    expect(parseCompileLogErrorLines("main.tex:7: Missing $ inserted")).toEqual([7]);
  });

  it("bắt dạng l.<n> của TeX", () => {
    const log = "! Undefined control sequence.\nl.57 \\badmacro";
    expect(parseCompileLogErrorLines(log)).toEqual([57]);
  });

  it("gộp cả hai dạng, loại trùng và sắp xếp tăng dần", () => {
    const log = [
      "./main.tex:90: Something",
      "l.12 \\foo",
      "./main.tex:42: Other",
      "l.42 \\foo", // trùng với 42 ở trên
    ].join("\n");
    expect(parseCompileLogErrorLines(log)).toEqual([12, 42, 90]);
  });

  it("bỏ qua dòng 0 và giá trị không hợp lệ", () => {
    expect(parseCompileLogErrorLines("./main.tex:0: bogus")).toEqual([]);
  });

  it("chỉ khớp l.<n> ở đầu dòng, không khớp giữa câu", () => {
    // "see l.99" nằm giữa dòng ⇒ không phải dạng báo lỗi của TeX.
    expect(parseCompileLogErrorLines("please see l.99 for details")).toEqual([]);
  });

  it("gọi lại nhiều lần cho cùng kết quả (regex /g không giữ lastIndex)", () => {
    const log = "./main.tex:5: A\nl.9 \\b";
    const first = parseCompileLogErrorLines(log);
    const second = parseCompileLogErrorLines(log);
    expect(first).toEqual([5, 9]);
    expect(second).toEqual(first);
  });
});
