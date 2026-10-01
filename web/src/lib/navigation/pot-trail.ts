export type TrailLink = { href: string; label: string };

/** Only allow a return path inside this Pot. */
export function safePotReturn(potId: string, from: string | null | undefined, fallback: string): string {
  if (!from) return fallback;
  const path = from.split('?')[0] ?? '';
  const prefix = `/pots/${potId}`;
  if (path !== prefix && !path.startsWith(`${prefix}/`)) return fallback;
  if (path.includes('//') || path.includes('..')) return fallback;
  return from.startsWith(prefix) ? from : fallback;
}

export function withReturn(href: string, returnTo: string): string {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set('from', returnTo);
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

export function activityListPath(
  potId: string,
  query: { type?: string; member?: string; category?: string; range?: string; from?: string; to?: string },
): string {
  const params = new URLSearchParams();
  if (query.type && query.type !== 'all') params.set('type', query.type);
  if (query.member && query.member !== 'all') params.set('member', query.member);
  if (query.category && query.category !== 'all') params.set('category', query.category);
  if (query.range && query.range !== 'all') params.set('range', query.range);
  if (query.range === 'custom' && query.from) params.set('from', query.from);
  if (query.range === 'custom' && query.to) params.set('to', query.to);
  const next = params.toString();
  const path = `/pots/${potId}/transactions`;
  return next ? `${path}?${next}` : path;
}

export function potReturnLabel(potId: string, href: string): string {
  const path = href.split('?')[0] ?? href;
  const rest = path.replace(`/pots/${potId}`, '') || '/';
  if (rest === '/' || rest === '') return 'Overview';
  if (/^\/transactions\/[^/]+$/.test(rest)) return 'Transaction';
  if (rest === '/transactions' || rest.startsWith('/transactions/')) return 'Activity';
  if (rest === '/members' || rest.startsWith('/members/')) return 'People';
  if (rest === '/balance') return 'Member';
  if (rest.startsWith('/contributions/')) return 'Contributions';
  if (rest.startsWith('/join-requests/')) return 'People';
  if (rest === '/settle') return 'Settle';
  if (rest === '/edit-settlement') return 'Settle';
  if (rest === '/more') return 'More';
  if (rest === '/commitments') return 'Planned payments';
  if (rest.startsWith('/commitments/')) return 'Planned payment';
  if (rest === '/pool') return 'Pool management';
  if (rest.startsWith('/pool/')) return 'Pool management';
  if (rest === '/invite') return 'Invite people';
  if (rest === '/summary') return 'Summary';
  if (rest === '/settings') return 'Pot settings';
  if (rest === '/settings/categories') return 'Categories';
  return 'Overview';
}

function uniqueCrumbs(crumbs: TrailLink[]): TrailLink[] {
  const out: TrailLink[] = [];
  for (const crumb of crumbs) {
    const last = out[out.length - 1];
    if (last && last.href === crumb.href && last.label === crumb.label) continue;
    out.push(crumb);
  }
  return out;
}

/**
 * Ancestors for a Pot screen. Null on the primary tabs and More itself,
 * where the Pot header already shows how to leave.
 */
export function resolvePotTrail(
  pathname: string,
  potId: string,
  potName: string,
  search: { from: string | null; txId: string | null; edit: string | null },
): { parent: TrailLink; crumbs: TrailLink[] } | null {
  const base = `/pots/${potId}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const rest = pathname.slice(base.length);

  const yourPots: TrailLink = { href: '/', label: 'Your pots' };
  const pot: TrailLink = { href: base, label: potName };
  const more: TrailLink = { href: `${base}/more`, label: 'More' };
  const activity: TrailLink = { href: `${base}/transactions`, label: 'Activity' };
  const people: TrailLink = { href: `${base}/members`, label: 'People' };
  const upcoming: TrailLink = { href: `${base}/commitments`, label: 'Planned payments' };
  const pool: TrailLink = { href: `${base}/pool`, label: 'Pool management' };
  const settle: TrailLink = { href: `${base}/settle`, label: 'Settle' };
  const settings: TrailLink = { href: `${base}/settings`, label: 'Pot settings' };

  if (rest === '' || rest === '/transactions' || rest === '/members' || rest === '/settle' || rest === '/more') {
    return null;
  }
  if (rest === '/commitments' || rest === '/invite' || rest === '/summary' || rest === '/pool' || rest === '/settings') {
    return { parent: more, crumbs: [yourPots, pot, more] };
  }
  if (rest.startsWith('/commitments/')) {
    const detail = /^\/commitments\/([^/]+)$/.exec(rest);
    if (detail && detail[1] !== 'new' && search.edit === '1') {
      const parent = { href: `${base}/commitments/${detail[1]}`, label: 'Planned payment' };
      return { parent, crumbs: [yourPots, pot, more, upcoming, parent] };
    }
    if (rest === '/commitments/new' && search.from) {
      const href = safePotReturn(potId, search.from, upcoming.href);
      const parent = { href, label: potReturnLabel(potId, href) };
      return { parent, crumbs: uniqueCrumbs([yourPots, pot, more, parent]) };
    }
    return { parent: upcoming, crumbs: [yourPots, pot, more, upcoming] };
  }
  if (rest === '/settings/categories') {
    return { parent: settings, crumbs: [yourPots, pot, more, settings] };
  }
  if (rest === '/pool/transfer' || rest === '/pool/reconcile') {
    return { parent: pool, crumbs: [yourPots, pot, more, pool] };
  }
  if (rest.startsWith('/transactions/')) {
    const href = safePotReturn(potId, search.from, activity.href);
    const parent = { href, label: potReturnLabel(potId, href) };
    const path = href.split('?')[0] ?? href;
    const extra: TrailLink[] = [];
    if (path.includes('/balance') || path.includes('/contributions/')) extra.push(people);
    else if (path.includes('/commitments')) extra.push(more, upcoming);
    else if (path.includes('/pool')) extra.push(more);
    else if (path.includes('/settle')) extra.push(settle);
    return { parent, crumbs: uniqueCrumbs([yourPots, pot, ...extra, parent]) };
  }
  if (rest === '/balance' || rest.startsWith('/join-requests/')) {
    return { parent: people, crumbs: [yourPots, pot, people] };
  }
  const memberContrib = /^\/contributions\/([^/]+)$/.exec(rest);
  if (memberContrib) {
    const parent = {
      href: `${base}/balance?memberId=${encodeURIComponent(memberContrib[1])}`,
      label: 'Member',
    };
    return { parent, crumbs: [yourPots, pot, people, parent] };
  }
  if (rest === '/edit-settlement') {
    const parent = search.txId
      ? { href: `${base}/transactions/${search.txId}`, label: 'Transaction' }
      : settle;
    return { parent, crumbs: uniqueCrumbs([yourPots, pot, settle, parent]) };
  }
  if (rest === '/add-money' || rest === '/add-expense') {
    const href = safePotReturn(potId, search.from, activity.href);
    const parent = { href, label: potReturnLabel(potId, href) };
    const path = href.split('?')[0] ?? href;
    const extra: TrailLink[] = [];
    if (path.includes('/members') || path.includes('/balance')) extra.push(people);
    else if (path.includes('/commitments')) extra.push(more, upcoming);
    else if (path.includes('/pool')) extra.push(more);
    else if (path.includes('/settle')) extra.push(settle);
    else if (path === `${base}/more`) extra.push(more);
    return { parent, crumbs: uniqueCrumbs([yourPots, pot, ...extra, parent]) };
  }
  return { parent: pot, crumbs: [yourPots, pot] };
}
