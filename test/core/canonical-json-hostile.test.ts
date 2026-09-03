import { describe, expect, test } from "vitest";
import { canonicalJson, sha256Digest, SothothInputError } from "../../packages/core/src/index.js";

describe("canonical JSON hostile input closure", () => {
  test("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ x: Number.NaN })).toThrowError(SothothInputError);
    expect(() => canonicalJson({ x: Number.POSITIVE_INFINITY })).toThrowError(SothothInputError);
    expect(() => canonicalJson({ x: Number.NEGATIVE_INFINITY })).toThrowError(SothothInputError);
    expect(() => canonicalJson(Number.NaN)).toThrowError(SothothInputError);
    expect(() => sha256Digest(Number.NaN as never)).toThrowError(SothothInputError);
  });

  test("rejects sparse arrays without filling holes", () => {
    const sparse = [1, , 3];
    expect(() => canonicalJson(sparse)).toThrowError(SothothInputError);
  });

  test("rejects symbols, functions, undefined, and bigint values", () => {
    expect(() => canonicalJson({ [Symbol("s")]: 1 })).toThrowError(SothothInputError);
    expect(() => canonicalJson({ s: Symbol("s") })).toThrowError(SothothInputError);
    expect(() => canonicalJson({ f: () => 1 })).toThrowError(SothothInputError);
    expect(() => canonicalJson({ u: undefined })).toThrowError(SothothInputError);
    expect(() => canonicalJson([undefined])).toThrowError(SothothInputError);
    expect(() => canonicalJson({ b: 1n })).toThrowError(SothothInputError);
  });

  test("rejects non-plain objects", () => {
    expect(() => canonicalJson(new Date(0))).toThrowError(SothothInputError);
    expect(() => canonicalJson(new Map<string, unknown>())).toThrowError(SothothInputError);
    expect(() => canonicalJson(new Set<unknown>())).toThrowError(SothothInputError);
    expect(() => canonicalJson(new (class Widget {})())).toThrowError(SothothInputError);
  });

  test("rejects cyclic objects while accepting shared non-cyclic references", () => {
    const cyclic: Record<string, unknown> = { name: "cycle" };
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrowError(SothothInputError);

    const mutualA: Record<string, unknown> = {};
    const mutualB: Record<string, unknown> = { a: mutualA };
    mutualA.b = mutualB;
    expect(() => canonicalJson(mutualA)).toThrowError(SothothInputError);

    const shared = { x: 1 };
    expect(canonicalJson({ b: shared, a: shared })).toBe('{"a":{"x":1},"b":{"x":1}}');
  });

  test("rejects accessors at any depth without executing them", () => {
    let calls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "secret", {
      enumerable: true,
      get() {
        calls += 1;
        return "leaked";
      },
    });

    expect(() => canonicalJson({ nested: [hostile] })).toThrowError(SothothInputError);
    expect(calls).toBe(0);
  });

  test("serializes null-prototype plain objects", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.a = 1;
    expect(canonicalJson(bare)).toBe('{"a":1}');
  });

  test("normalizes negative zero to 0", () => {
    expect(canonicalJson({ n: -0 })).toBe('{"n":0}');
  });

  test("formats numbers deterministically", () => {
    expect(canonicalJson([0.5, 1e21])).toBe("[0.5,1e+21]");
  });

  test("escapes strings deterministically", () => {
    expect(canonicalJson({ k: 'quote" backslash\\ newline\n' })).toBe(
      '{"k":"quote\\" backslash\\\\ newline\\n"}',
    );
  });

  test("sorts keys by Unicode code point, not UTF-16 code unit", () => {
    // U+E000 sorts before U+1F600 by code point, but after the "😀" surrogate
    // lead by UTF-16 code unit; this case distinguishes the two orderings.
    expect(canonicalJson({ "\u{1F600}": 2, "\uE000": 1 })).toBe('{"\uE000":1,"\u{1F600}":2}');
    expect(canonicalJson({ "\u{1F600}": 2, zz: 0, "\uE000": 1 })).toBe('{"zz":0,"\uE000":1,"\u{1F600}":2}');
  });

  test("sorts nested object keys recursively and preserves array order", () => {
    expect(canonicalJson({ z: { c: 1, a: 2 }, a: [3, 2, 1] })).toBe(
      '{"a":[3,2,1],"z":{"a":2,"c":1}}',
    );
  });

  test("is independent of key insertion order", () => {
    const first: Record<string, unknown> = {};
    first.a = 1;
    first.b = 2;
    const second: Record<string, unknown> = {};
    second.b = 2;
    second.a = 1;
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(canonicalJson(first)).toBe('{"a":1,"b":2}');
  });

  test("digests JSON values over their canonical bytes", () => {
    expect(sha256Digest({ b: 2, a: 1 })).toBe(
      "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    );
    expect(sha256Digest("")).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
