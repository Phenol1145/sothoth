/**
 * Iterative descriptor-safe deep copy and freeze for
 * `@sothoth/document-index`.
 *
 * Internal responsibility unit of the package: never re-exported from any
 * public subpath. Every value this package exposes passes through this
 * module, which walks with an explicit work stack (never recursion
 * proportional to input size) and only ever over values that already passed
 * the closed validation grammars, so no cycle and no accessor can occur
 * here. Prototypes normalize to ordinary objects and arrays, every own
 * string key — including `"__proto__"` — is defined through
 * `Object.defineProperty` so plain assignment can never reach the inherited
 * setter, and every container is frozen before exposure.
 */

/** Defines an enumerable own data property prototype-safely. */
export function defineOwnData(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** Own string names of a container, treating an array's `length` as structural. */
function ownDataNames(source: object): string[] {
  const names = Object.getOwnPropertyNames(source);
  return Array.isArray(source) ? names.filter((name) => name !== "length") : names;
}

/** A fresh ordinary container of the same kind as a validated source value. */
function containerFor(source: object): object {
  return Array.isArray(source) ? [] : {};
}

interface CopyFrame {
  readonly source: object;
  readonly dest: object;
  readonly names: string[];
  index: number;
}

/**
 * Returns a descriptor-safe deep copy of a validated JSON value, deeply
 * frozen, with no shared mutable reference to the input. Primitives pass
 * through unchanged. Key order may differ from the input; the canonical JSON
 * own-data value and bytes are preserved.
 */
export function deepFrozenCopy<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const source = value as object;
  const root = containerFor(source);
  const stack: CopyFrame[] = [{ source, dest: root, names: ownDataNames(source), index: 0 }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    if (frame.index >= frame.names.length) {
      stack.pop();
      Object.freeze(frame.dest);
      continue;
    }
    const name = frame.names[frame.index]!;
    frame.index += 1;
    const descriptor = Object.getOwnPropertyDescriptor(frame.source, name);
    const child = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    if (child !== null && typeof child === "object") {
      const childDest = containerFor(child);
      defineOwnData(frame.dest, name, childDest);
      stack.push({ source: child, dest: childDest, names: ownDataNames(child), index: 0 });
    } else {
      defineOwnData(frame.dest, name, child);
    }
  }
  return root as T;
}

/**
 * Freezes a freshly built output value in place, walking with an explicit
 * stack so no call-stack depth proportional to result size is added. Used on
 * values this package constructed itself; freezing is idempotent, so
 * subtrees built by `deepFrozenCopy` are simply re-confirmed.
 */
export function deepFreezeInPlace<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const stack: object[] = [value as object];
  while (stack.length > 0) {
    const current = stack.pop()!;
    Object.freeze(current);
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === "length" && Array.isArray(current)) {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor === undefined || !("value" in descriptor)) {
        continue;
      }
      const child = descriptor.value;
      if (child !== null && typeof child === "object") {
        stack.push(child);
      }
    }
  }
  return value;
}
