import { isSafeOutboundUrl } from '@/lib/security';

/**
 * fetch() for URLs that come from users (link destinations, preview images, domains).
 * Every hop, including each redirect, must pass isSafeOutboundUrl, so a public URL can't
 * redirect the server into localhost, the private network or cloud metadata endpoints.
 */
export async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = isSafeOutboundUrl(current);
    if (!check.safe) throw new Error(`Blocked destination: ${check.reason}`);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      res.body?.cancel().catch(() => {});
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}
