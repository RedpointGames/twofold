import { expect, test } from "vitest";
import { getPathPatternFromPath } from "../../src/backend/utils/pattern";

test("path pattern works", () => {
  expect(getPathPatternFromPath("/(root)/a/$b/c/$d")).toEqual("/a/:b/c/:d");
  expect(getPathPatternFromPath("/(root)/a/$b")).toEqual("/a/:b");
  expect(getPathPatternFromPath("/(root)/a/(b)/c/$d")).toEqual("/a/c/:d");
});
