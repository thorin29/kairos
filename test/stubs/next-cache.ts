// vitest stub for next/cache: the cores call revalidatePath after a write, which
// is a no-op outside the Next runtime.
export function revalidatePath(_path?: string, _type?: string): void {}
export function revalidateTag(_tag?: string): void {}
export function unstable_cache<T>(fn: T): T {
  return fn;
}
