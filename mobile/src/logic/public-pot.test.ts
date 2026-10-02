import {
  PUBLIC_SHARE_OFF,
  activityKind,
  activityTitle,
  buildPublicPotUrl,
  buildShareMessage,
  contributorSummaries,
  expensePayer,
  extractPublicToken,
  formatPublicDate,
  groupByDate,
  isPlausiblePublicToken,
  parsePublicPotResponse,
  parsePublicShareState,
  participantSummary,
  publicContributions,
  publicExpenses,
  publicPotPath,
  type PublicPot,
} from '@/logic/public-pot';

const TOKEN = 'aB3_-xYz9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0LzXcVbN';

const okResponse = {
  status: 'ok',
  pot: { name: 'Goa Trip 2026', description: 'Beach week', currency: 'INR', archived: false },
  summary: { member_count: 3, contributed: 15000, spent: 5000, balance: 12000, transaction_count: 4 },
  members: [
    { name: 'Asha', contributed: 5000 },
    { name: 'Riya', contributed: 10000 },
    { name: 'Mohan', contributed: 0 },
  ],
  transactions: [
    {
      type: 'settlement',
      description: 'Settle up',
      amount: 500,
      date: '2026-03-05',
      created_at: '2026-03-05T10:00:00Z',
      paid_by: 'Riya',
      to: 'Asha',
      category: null,
      participants: [],
    },
    {
      type: 'member_expense',
      description: 'Taxi',
      amount: 2000,
      date: '2026-03-04',
      created_at: '2026-03-04T10:00:00Z',
      paid_by: 'Mohan',
      to: null,
      category: { name: 'Transport', icon: 'car', color: 'blue' },
      participants: ['Asha', 'Mohan'],
    },
    {
      type: 'pool_expense',
      description: 'Lunch',
      amount: 3000,
      date: '2026-03-04',
      created_at: '2026-03-04T09:00:00Z',
      paid_by: null,
      to: null,
      category: null,
      participants: ['Asha', 'Riya', 'Mohan', 'Guest'],
    },
    {
      type: 'contribution',
      description: 'Top-up',
      amount: 10000,
      date: '2026-03-01',
      created_at: '2026-03-01T09:00:00Z',
      paid_by: 'Riya',
      to: null,
      category: null,
      participants: [],
    },
  ],
  transactions_truncated: false,
  viewer_pot_id: null,
  generated_at: '2026-03-06T00:00:00Z',
};

function parsedPot(): PublicPot {
  const result = parsePublicPotResponse(okResponse);
  if (result.status !== 'ok') throw new Error('expected ok');
  return result.pot;
}

describe('isPlausiblePublicToken', () => {
  it('accepts a url-safe token of 32+ characters', () => {
    expect(isPlausiblePublicToken(TOKEN)).toBe(true);
  });

  it('never accepts a pot id (uuid), so /pot/<id> is never read as a share link', () => {
    expect(isPlausiblePublicToken('3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9e1b34')).toBe(false);
    expect(isPlausiblePublicToken('3F2B8C1E-9A4D-4E6B-8F10-2C7D5A9E1B34')).toBe(false);
  });

  it.each([null, undefined, '', 'short', 'a'.repeat(31), 'a'.repeat(129), `${TOKEN}!`, `${TOKEN} `, 'a b'.repeat(20)])(
    'rejects %p',
    (value) => {
      expect(isPlausiblePublicToken(value as string | null | undefined)).toBe(false);
    },
  );
});

describe('parsePublicPotResponse', () => {
  it('maps the RPC payload to a camelCase pot', () => {
    const pot = parsedPot();
    expect(pot.name).toBe('Goa Trip 2026');
    expect(pot.description).toBe('Beach week');
    expect(pot.memberCount).toBe(3);
    expect(pot.contributed).toBe(15000);
    expect(pot.spent).toBe(5000);
    expect(pot.balance).toBe(12000);
    expect(pot.transactions).toHaveLength(4);
    expect(pot.transactions[1].category).toEqual({ name: 'Transport', icon: 'car', color: 'blue' });
    expect(pot.transactions[0].to).toBe('Asha');
    expect(pot.viewerPotId).toBeNull();
    expect(pot.truncated).toBe(false);
  });

  it('passes through the unavailable states', () => {
    expect(parsePublicPotResponse({ status: 'not_found' })).toEqual({ status: 'not_found' });
    expect(parsePublicPotResponse({ status: 'revoked' })).toEqual({ status: 'revoked' });
  });

  it('throws on shapes it does not recognise so the UI shows an error + retry', () => {
    expect(() => parsePublicPotResponse(null)).toThrow();
    expect(() => parsePublicPotResponse('ok')).toThrow();
    expect(() => parsePublicPotResponse([])).toThrow();
    expect(() => parsePublicPotResponse({ status: 'weird' })).toThrow();
    expect(() => parsePublicPotResponse({ status: 'ok' })).toThrow();
  });

  it('drops malformed or unknown transaction rows instead of rendering them', () => {
    const result = parsePublicPotResponse({
      ...okResponse,
      transactions: [okResponse.transactions[0], null, 'x', { type: 'pool_transfer', amount: 1 }, { amount: 5 }],
    });
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.pot.transactions).toHaveLength(1);
  });

  it('coerces numeric strings (bigint over JSON) and defaults missing arrays', () => {
    const result = parsePublicPotResponse({
      status: 'ok',
      pot: { name: 'X', archived: true },
      summary: { member_count: '2', contributed: '100', spent: '40', balance: '60', transaction_count: '1' },
    });
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.pot).toMatchObject({
      archived: true,
      memberCount: 2,
      contributed: 100,
      spent: 40,
      balance: 60,
      members: [],
      transactions: [],
      description: null,
    });
  });

  it('only exposes a viewer pot id when the server sent one', () => {
    const result = parsePublicPotResponse({ ...okResponse, viewer_pot_id: 'pot-123' });
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.pot.viewerPotId).toBe('pot-123');
  });
});

describe('derived lists', () => {
  it('splits contributions from expenses and ignores settlements in both', () => {
    const pot = parsedPot();
    expect(publicContributions(pot).map((t) => t.description)).toEqual(['Top-up']);
    expect(publicExpenses(pot).map((t) => t.description)).toEqual(['Taxi', 'Lunch']);
  });

  it('summarises contributors biggest first, leaving out members who gave nothing', () => {
    const rows = contributorSummaries(parsedPot());
    expect(rows.map((r) => r.name)).toEqual(['Riya', 'Asha']);
    expect(rows[0].share).toBeCloseTo(2 / 3);
    expect(rows[0].share + rows[1].share).toBeCloseTo(1);
  });

  it('does not divide by zero when nothing has been contributed', () => {
    const pot = { ...parsedPot(), members: [{ name: 'A', contributed: 0 }] };
    expect(contributorSummaries(pot)).toEqual([]);
  });

  it('groups consecutive transactions by day, preserving order', () => {
    const groups = groupByDate(parsedPot().transactions);
    expect(groups.map((g) => [g.date, g.items.length])).toEqual([
      ['2026-03-05', 1],
      ['2026-03-04', 2],
      ['2026-03-01', 1],
    ]);
  });
});

describe('labels', () => {
  const tx = parsedPot().transactions;

  it('names the kind of activity', () => {
    expect(tx.map((t) => activityKind(t.type))).toEqual(['Settlement', 'Expense', 'Expense', 'Contribution']);
  });

  it('writes a readable title per type', () => {
    expect(activityTitle(tx[0])).toBe('Riya paid Asha');
    expect(activityTitle(tx[1])).toBe('Taxi');
    expect(activityTitle(tx[3])).toBe('Riya contributed');
    expect(activityTitle({ ...tx[3], paidBy: null })).toBe('Someone contributed');
  });

  it('says who funded an expense', () => {
    expect(expensePayer(tx[1])).toBe('Paid by Mohan');
    expect(expensePayer(tx[2])).toBe('Paid from the pool');
    expect(expensePayer({ ...tx[2], paidBy: 'Asha' })).toBe('Paid from the pool by Asha');
    expect(expensePayer({ ...tx[1], paidBy: null })).toBe('Paid by a member');
  });

  it('summarises participants without listing a crowd', () => {
    expect(participantSummary([])).toBe('');
    expect(participantSummary(['Asha'])).toBe('For Asha');
    expect(participantSummary(['Asha', 'Riya'])).toBe('Split among Asha and Riya');
    expect(participantSummary(['A', 'B', 'C'])).toBe('Split among A, B and C');
    expect(participantSummary(['A', 'B', 'C', 'D'])).toBe('Split among A, B, C and 1 other');
    expect(participantSummary(['A', 'B', 'C', 'D', 'E'])).toBe('Split among A, B, C and 2 others');
  });
});

describe('formatPublicDate', () => {
  it('formats from the string parts so every timezone agrees', () => {
    expect(formatPublicDate('2026-03-05')).toBe('5 Mar 2026');
    expect(formatPublicDate('2026-12-31')).toBe('31 Dec 2026');
    expect(formatPublicDate('2026-01-01T10:00:00Z')).toBe('1 Jan 2026');
  });

  it('returns unparseable input unchanged instead of "Invalid Date"', () => {
    expect(formatPublicDate('')).toBe('');
    expect(formatPublicDate('soon')).toBe('soon');
    expect(formatPublicDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('links and messages', () => {
  it('builds the path and absolute URL', () => {
    expect(publicPotPath(TOKEN)).toBe(`/pot/${TOKEN}`);
    expect(buildPublicPotUrl('https://trypotto.in', TOKEN)).toBe(`https://trypotto.in/pot/${TOKEN}`);
    expect(buildPublicPotUrl('https://trypotto.in///', TOKEN)).toBe(`https://trypotto.in/pot/${TOKEN}`);
  });

  it('extracts the token from shared links and deep-link paths', () => {
    expect(extractPublicToken(`https://www.trypotto.in/pot/${TOKEN}`)).toBe(TOKEN);
    expect(extractPublicToken(`https://www.trypotto.in/pot/${TOKEN}/`)).toBe(TOKEN);
    expect(extractPublicToken(`/pot/${TOKEN}?utm=x#top`)).toBe(TOKEN);
    expect(extractPublicToken(`potto://pot/${TOKEN}`)).toBe(TOKEN);
  });

  it('refuses anything that is not a /pot/<token> link', () => {
    expect(extractPublicToken(TOKEN)).toBeNull();
    expect(extractPublicToken('https://trypotto.in/pot/short')).toBeNull();
    expect(extractPublicToken(`https://trypotto.in/pots/${TOKEN}`)).toBeNull();
    expect(extractPublicToken(`https://trypotto.in/pot/${TOKEN}/members`)).toBeNull();
    expect(extractPublicToken('')).toBeNull();
  });

  it('leaves signed-in pot links (/pot/<uuid>) alone', () => {
    expect(extractPublicToken('/pot/3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9e1b34')).toBeNull();
    expect(extractPublicToken('potto://pot/3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9e1b34/settings')).toBeNull();
  });

  it('writes the share message', () => {
    expect(buildShareMessage('Goa Trip 2026')).toBe('Check out our Goa Trip 2026 pot on Potto:');
    expect(buildShareMessage('  ')).toBe('Check out our Potto pot on Potto:');
  });
});

describe('parsePublicShareState', () => {
  it('reads an enabled row (PostgREST returns an array)', () => {
    expect(
      parsePublicShareState([{ enabled: true, token: TOKEN, shared_at: '2026-03-01T00:00:00Z', can_manage: true }]),
    ).toEqual({ enabled: true, token: TOKEN, sharedAt: '2026-03-01T00:00:00Z', canManage: true });
  });

  it('treats an enabled row with no token as off', () => {
    expect(parsePublicShareState({ enabled: true, token: null, can_manage: true })).toEqual({
      enabled: false,
      token: null,
      sharedAt: null,
      canManage: true,
    });
  });

  it('never leaks a token while disabled', () => {
    expect(parsePublicShareState({ enabled: false, token: TOKEN, can_manage: false }).token).toBeNull();
  });

  it('falls back to off for empty or garbage input', () => {
    expect(parsePublicShareState([])).toEqual(PUBLIC_SHARE_OFF);
    expect(parsePublicShareState(null)).toEqual(PUBLIC_SHARE_OFF);
    expect(parsePublicShareState('x')).toEqual(PUBLIC_SHARE_OFF);
  });
});
