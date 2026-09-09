import { describe, expect, it } from "vitest";
import { nextOffset, uniqueRows } from "../pagination";
describe("history pagination", () => {
  it("continues beyond the first hundred and stops only on a short page", () => {
    expect(nextOffset(100, 0)).toBe(100);
    expect(nextOffset(100, 100)).toBe(200);
    expect(nextOffset(23, 200)).toBeUndefined();
    expect(nextOffset(0, 0)).toBeUndefined();
  });
  it("deduplicates records if a newly inserted inspection shifts an offset boundary", () => {
    expect(
      uniqueRows([
        [{ id: "a" }, { id: "b" }],
        [{ id: "b" }, { id: "c" }],
      ]),
    ).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });
});
