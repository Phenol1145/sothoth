import { describe, expect, test } from "vitest";
import { canonicalJson, sha256Digest, SothothInputError } from "../../packages/core/src/index.js";

describe("canonical JSON", () => {
  test("orders object keys by Unicode code point while preserving array order", () => {
    expect(canonicalJson({ z: 1, a: [3, 2, 1], "😀": true })).toBe('{"a":[3,2,1],"z":1,"😀":true}');
  });

  test("rejects an accessor without executing it", () => {
    let calls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "secret", {
      enumerable: true,
      get() {
        calls += 1;
        return "leaked";
      },
    });

    expect(() => canonicalJson(hostile)).toThrowError(SothothInputError);
    expect(calls).toBe(0);
  });

  test("uses a prefixed SHA-256 digest", () => {
    expect(sha256Digest("")).toBe("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
