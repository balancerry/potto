import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PublicPotUnavailable } from '@/components/public/public-pot-unavailable';
import { PublicPotView } from '@/components/public/public-pot-view';
import { publicPotPath } from '@/lib/core/logic/public-pot';
import { formatMoney } from '@/lib/core/money';
import { getPublicPot } from '@/lib/queries/public-pot';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
};

// A share link is a bearer secret: keep it out of search engines and out of Referer headers.
const PRIVATE_LINK = { robots: { index: false, follow: false }, referrer: 'no-referrer' } as const;

// Reuse the site-wide card (app/opengraph-image.tsx); a page-level openGraph/twitter object would otherwise drop it.
const SHARE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Potto' };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { token } = await params;
  try {
    const result = await getPublicPot(token);
    if (result.status === 'ok') {
      const { pot } = result;
      const description = `Read-only view: ${pot.memberCount} ${pot.memberCount === 1 ? 'member' : 'members'}, ${formatMoney(pot.contributed)} contributed, ${formatMoney(pot.spent)} spent.`;
      return {
        ...PRIVATE_LINK,
        title: pot.name,
        description,
        openGraph: { title: `${pot.name} on Potto`, description, url: publicPotPath(token), siteName: 'Potto', type: 'website', images: [SHARE_IMAGE] },
        twitter: { card: 'summary_large_image', title: `${pot.name} on Potto`, description, images: [SHARE_IMAGE.url] },
      };
    }
    return { ...PRIVATE_LINK, title: result.status === 'revoked' ? 'Pot unavailable' : 'Pot not found' };
  } catch {
    // The page itself will surface the error + retry; metadata just stays generic.
    return { ...PRIVATE_LINK, title: 'Shared pot' };
  }
}

export default async function PublicPotPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { preview } = await searchParams;

  const result = await getPublicPot(token);
  if (result.status === 'not_found') notFound();
  if (result.status === 'revoked') return <PublicPotUnavailable />;

  // Signed-in members get the normal app. `?preview=1` (the Share sheet's "Preview" link)
  // skips this so an admin can see exactly what everyone else sees.
  if (result.pot.viewerPotId && preview !== '1') redirect(`/pots/${result.pot.viewerPotId}`);

  return <PublicPotView pot={result.pot} />;
}
