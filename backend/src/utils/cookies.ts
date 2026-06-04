export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    const value = decodeURI(parts.join('=')?.trim());
    if (name) {
      list[name] = value;
    }
  });

  return list;
}
