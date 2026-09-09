/**
 * Fixtures are shared constants: many of them are built by spreading another one, so their nested
 * objects and arrays are the SAME references (`productWithoutPhotos.specs === letter.specs`, every
 * order sharing one `shippingAddress`). Rebuilding each nested literal by hand would be verbose
 * and would still rot. Freezing them instead turns a story that mutates a fixture from a silent
 * corruption of some other story into an immediate TypeError, which is the failure mode we want.
 * Spreading a frozen object to override fields still works, which is how stories should vary them.
 */
export function deepFreeze<T>(value: T): T {
  if (value && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key])
    }
  }
  return value
}
