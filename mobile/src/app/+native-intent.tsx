import { extractPublicToken } from '@/logic/public-pot';

/**
 * Rewrites incoming links before Expo Router resolves them.
 *
 * A shared pot link is `https://<site>/pot/<token>` (also `potto://pot/<token>`). In this app
 * `/pot/<id>` is already the signed-in pot screen, so a share token must be sent to its own
 * read-only route instead. `extractPublicToken` only matches a token-shaped segment and never a
 * pot UUID, so existing `/pot/<uuid>` links keep working exactly as before.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const token = extractPublicToken(path);
    if (token) return `/shared/${token}`;
  } catch {
    // Fall through: an unparseable path is left for the router to deal with.
  }
  return path;
}
