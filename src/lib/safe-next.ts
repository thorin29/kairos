/** A relative in-app path, or "/" — never an absolute URL, so `next` can't be
 *  used to bounce a session somewhere off-site. Browsers read a backslash as a
 *  slash, so "/\\evil.com" means "//evil.com" (fixed v0.699): no backslashes,
 *  control characters or scheme-relative starts. */
export function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/";
  return value;
}
