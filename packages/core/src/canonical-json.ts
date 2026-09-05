/**
 * Canonical JSON serialization for the Sothoth kernel.
 *
 * Public module `@project-sothoth/core/canonical-json`. Canonical JSON serializes
 * recursively key-sorted with compact separators: object keys sort in Unicode
 * code-point order, array order is preserved, and no whitespace is emitted.
 * Hostile values fail closed as `sothoth.input/invalid-json-value` —
 * non-finite numbers, sparse arrays, symbol keys or values, functions,
 * bigint and undefined values, non-plain objects, accessors, and cyclic
 * structures are rejected. Accessor properties are detected through property
 * descriptors and never executed, so a hostile record cannot leak through a
 * getter. Serialization is a pure function of its argument.
 */

import { compareCodePointOrder } from "./code-point-order.js";

/** The error the kernel raises when a value is not a closed JSON value. */
export class SothothInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SothothInputError";
    this.code = code;
  }
}

function invalid(reason: string): never {
  throw new SothothInputError("sothoth.input/invalid-json-value", reason);
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    invalid(`non-finite number ${String(value)} is not a JSON value`);
  }
  return JSON.stringify(value);
}

function ownDataValue(owner: object, key: string, index: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    return invalid(`${index} "${key}" is not a data property`);
  }
  return descriptor.value;
}

function serializeArray(value: readonly unknown[], ancestors: Set<object>): string {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    invalid("symbol keys are not JSON values");
  }
  // An array's own `length` property is structural, not an element; every
  // other own name must be one of the dense indices 0..length-1, so a count
  // mismatch flags a hole or an extra property and each slot is then read
  // through its descriptor so accessors fail closed without executing.
  const indexNames = Object.getOwnPropertyNames(value).filter((name) => name !== "length");
  if (indexNames.length !== value.length) {
    invalid("sparse arrays and arrays with extra properties are not JSON values");
  }
  ancestors.add(value);
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const element = ownDataValue(value, String(index), "array slot");
    parts.push(serialize(element, ancestors));
  }
  ancestors.delete(value);
  return `[${parts.join(",")}]`;
}

function serializeObject(value: object, ancestors: Set<object>): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid("only plain objects are JSON values");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    invalid("symbol keys are not JSON values");
  }
  const names = Object.getOwnPropertyNames(value).sort(compareCodePointOrder);
  ancestors.add(value);
  const parts: string[] = [];
  for (const name of names) {
    const propertyValue = ownDataValue(value, name, "object property");
    parts.push(`${JSON.stringify(name)}:${serialize(propertyValue, ancestors)}`);
  }
  ancestors.delete(value);
  return `{${parts.join(",")}}`;
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeNumber(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      if (ancestors.has(value)) {
        return invalid("cyclic structures are not JSON values");
      }
      return Array.isArray(value)
        ? serializeArray(value, ancestors)
        : serializeObject(value, ancestors);
    default:
      return invalid(`a ${typeof value} is not a JSON value`);
  }
}

/**
 * Serializes a JSON-compatible value to canonical bytes.
 *
 * Accepts `unknown` and validates fail closed: any value outside the closed
 * JSON grammar raises `SothothInputError` with code
 * `sothoth.input/invalid-json-value` before any accessor could execute.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value, new Set());
}
