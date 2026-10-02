import { NextResponse } from 'next/server';

/**
 * Android App Links: lets the Potto app open `/pot/<token>` share links when installed.
 * Needs ANDROID_PACKAGE and ANDROID_SHA256_CERT_FINGERPRINTS (comma-separated, from Play App
 * Signing or `eas credentials`). Until both are set this returns 404.
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE?.trim();
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (!packageName || fingerprints.length === 0) return new NextResponse(null, { status: 404 });

  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
