import { NextResponse } from 'next/server';

/**
 * iOS Universal Links: lets the Potto app open `/pot/<token>` share links when installed.
 * Needs the app's full id (`<TeamID>.<bundle id>`) in APPLE_APP_ID. Until that is set this
 * returns 404, so nothing claims the domain with made-up identifiers.
 */
export function GET() {
  const appId = process.env.APPLE_APP_ID?.trim();
  if (!appId) return new NextResponse(null, { status: 404 });

  return NextResponse.json({
    applinks: {
      details: [{ appIDs: [appId], components: [{ '/': '/pot/*', comment: 'Public read-only pot links' }] }],
    },
  });
}
