/**
 * Internal own-data property discipline for the contract validators.
 *
 * Not a public family: nothing in this module is re-exported from any
 * accepted subpath or the package root. Validators learn every known field
 * through `Object.getOwnPropertyDescriptor`, so a hostile accessor is
 * rejected as a contract violation without its getter ever executing, and
 * an inherited field can never masquerade as a present own field.
 */

/** The own-property state of one known field, read without side effects. */
export type OwnDataField =
  | { readonly state: "missing" }
  | { readonly state: "accessor" }
  | { readonly state: "data"; readonly value: unknown };

/**
 * Reads the own-property state of `key` on `owner` without executing any
 * accessor: a missing own property (including an inherited one) is
 * `missing`, an own accessor — or any other value-less descriptor — is
 * `accessor`, and an own data property is `data` carrying its descriptor
 * value.
 */
export function readOwnDataField(owner: object, key: string): OwnDataField {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (descriptor === undefined) {
    return { state: "missing" };
  }
  if (!("value" in descriptor)) {
    return { state: "accessor" };
  }
  return { state: "data", value: descriptor.value };
}
