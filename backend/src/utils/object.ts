// Repository list queries build their Mongo filter as `{ ...someOptionalFilter }` —
// when an optional filter key is omitted by the caller, its value is `undefined`, not
// absent. Spreading that straight into a query object keeps the key with an explicit
// `undefined` value, and MongoDB matches that against the deprecated BSON "Undefined"
// type (which no real document ever has) instead of ignoring the field — silently
// zeroing every result. This strips undefined-valued keys before the spread so an
// omitted filter genuinely means "don't filter on this field."
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
}
