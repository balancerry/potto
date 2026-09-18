import { calculateCustomShares, calculateExpenseShares, calculatePercentageShares } from '@/logic/accounting';
import type { Commitment, CommitmentPayment, JoinRequest, Member, Pot, PottoUser, Transaction } from '@/types/models';
import { uid } from '@/utils/money';

interface SeedResult {
  currentUser: PottoUser;
  currentUserName: string;
  pots: Record<string, Pot>;
  transactions: Record<string, Transaction[]>;
  joinRequests: Record<string, JoinRequest[]>;
  commitments: Record<string, Commitment[]>;
  commitmentPayments: Record<string, CommitmentPayment[]>;
}

/** The device's simulated authenticated identity (no real backend exists yet). */
const CURRENT_USER: PottoUser = { id: uid('user'), name: 'Raj' };

function makeMembers(names: string[], joinedAt: string, viewOnlyNames: string[] = []): Member[] {
  return names.map((name, i) => ({
    id: uid('mem'),
    name,
    role: i === 0 ? 'admin' : 'member',
    accessLevel: viewOnlyNames.includes(name) ? 'view_only' : 'member',
    status: 'active',
    userId: i === 0 ? CURRENT_USER.id : null,
    joinedAt,
  }));
}

export function buildSeed(): SeedResult {
  // ---------------- Goa 2026 ----------------
  const goaId = 'goa';
  const goaMembers = makeMembers(['Raj', 'Amit', 'Neha', 'Karan', 'Rohit', 'Priya', 'Ankit'], '2026-09-01', ['Ankit']);
  const byName = Object.fromEntries(goaMembers.map((m) => [m.name, m]));
  const allIds = goaMembers.map((m) => m.id);

  const goaTxs: Transaction[] = [];
  const pushGoa = (t: Omit<Transaction, 'id' | 'potId' | 'createdAt'> & { date: string }) => {
    goaTxs.push({ id: uid('tx'), potId: goaId, createdAt: t.date, ...t });
  };

  goaMembers.forEach((m) => {
    const amount = m.name === 'Raj' ? 1500000 : 800000; // paise
    pushGoa({
      type: 'contribution',
      description: 'Trip contribution',
      amount,
      paidBy: m.id,
      date: '2026-09-01',
      note: 'Initial contribution',
      createdBy: m.id,
    });
  });

  pushGoa({
    type: 'pool_expense',
    description: 'Villa Booking',
    amount: 3500000,
    category: 'Stay',
    paymentSource: 'pool',
    participants: allIds,
    splits: calculateExpenseShares(3500000, allIds),
    splitMethod: 'equal',
    date: '2026-09-16',
    note: '4-night villa near Anjuna',
    createdBy: byName.Raj.id,
  });

  const dinnerParticipants = [byName.Raj.id, byName.Amit.id, byName.Neha.id, byName.Karan.id];
  pushGoa({
    type: 'member_expense',
    description: 'Dinner at Thalassa',
    amount: 850000,
    category: 'Food',
    paymentSource: 'personal',
    paidBy: byName.Raj.id,
    participants: dinnerParticipants,
    splits: calculateExpenseShares(850000, dinnerParticipants),
    splitMethod: 'equal',
    date: '2026-09-17',
    note: 'Sunset dinner',
    createdBy: byName.Raj.id,
  });

  const cabPercentages: Record<string, number> = {
    [byName.Raj.id]: 20,
    [byName.Amit.id]: 20,
    [byName.Neha.id]: 15,
    [byName.Karan.id]: 15,
    [byName.Rohit.id]: 10,
    [byName.Priya.id]: 10,
    [byName.Ankit.id]: 10,
  };
  pushGoa({
    type: 'pool_expense',
    description: 'Airport Cabs',
    amount: 500000,
    category: 'Transport',
    paymentSource: 'pool',
    participants: allIds,
    splits: calculatePercentageShares(500000, cabPercentages),
    splitMethod: 'percentage',
    date: '2026-09-17',
    note: 'Split by distance travelled',
    createdBy: byName.Raj.id,
  });

  const scubaParticipants = allIds.slice(0, 5);
  pushGoa({
    type: 'pool_expense',
    description: 'Scuba Diving',
    amount: 800000,
    category: 'Activities',
    paymentSource: 'pool',
    participants: scubaParticipants,
    splits: calculateExpenseShares(800000, scubaParticipants),
    splitMethod: 'equal',
    date: '2026-09-18',
    note: 'Only 5 joined',
    createdBy: byName.Amit.id,
  });

  pushGoa({
    type: 'member_expense',
    description: 'Groceries & Snacks',
    amount: 270000,
    category: 'Groceries',
    paymentSource: 'personal',
    paidBy: byName.Amit.id,
    participants: allIds,
    splits: calculateCustomShares({
      [byName.Raj.id]: 45000,
      [byName.Amit.id]: 45000,
      [byName.Neha.id]: 30000,
      [byName.Karan.id]: 30000,
      [byName.Rohit.id]: 40000,
      [byName.Priya.id]: 40000,
      [byName.Ankit.id]: 40000,
    }),
    splitMethod: 'custom',
    date: '2026-09-18',
    note: 'Split by what each person picked up',
    createdBy: byName.Amit.id,
  });

  pushGoa({
    type: 'settlement',
    description: 'Settlement',
    amount: 220000,
    paidBy: byName.Karan.id,
    toMember: byName.Neha.id,
    date: '2026-09-19',
    createdBy: byName.Karan.id,
  });

  // ---- Upcoming Payments (Commitments) — matches the worked scenario in
  // src/mvp/Potto_Upcoming_Payments_Commitments_Spec.md sections 15 & 34.
  const goaCommitments: Commitment[] = [];
  const goaCommitmentPayments: CommitmentPayment[] = [];

  // Hotel / Sea View Resort: ₹42,000 total, ₹20,000 already paid personally by
  // Raj (a normal member_expense — the Commitment never touches accounting
  // directly, only this actual transaction does).
  const hotelId = uid('cmt');
  const hotelPaymentTxId = uid('tx');
  goaTxs.push({
    id: hotelPaymentTxId,
    potId: goaId,
    type: 'member_expense',
    description: 'Hotel advance — Sea View Resort',
    amount: 2000000,
    category: 'Stay',
    paymentSource: 'personal',
    paidBy: byName.Raj.id,
    participants: allIds,
    splits: calculateExpenseShares(2000000, allIds),
    splitMethod: 'equal',
    date: '2026-09-20',
    createdAt: '2026-09-20T09:00:00.000Z',
    createdBy: byName.Raj.id,
    note: 'Advance paid at check-in',
  });
  goaCommitments.push({
    id: hotelId,
    potId: goaId,
    title: 'Hotel',
    vendorName: 'Sea View Resort',
    category: 'Stay',
    description: '3 nights',
    totalAmount: 4200000,
    dueDate: '2026-12-10',
    status: 'planned', // re-derived from payments by deriveCommitmentStatus; never trusted as-is for display
    createdBy: byName.Raj.id,
    createdAt: '2026-09-19T12:00:00.000Z',
    updatedAt: '2026-09-20T09:00:00.000Z',
  });
  goaCommitmentPayments.push({
    id: uid('cpay'),
    potId: goaId,
    commitmentId: hotelId,
    transactionId: hotelPaymentTxId,
    amount: 2000000,
    createdAt: '2026-09-20T09:00:00.000Z',
  });

  // Airport Taxi: ₹8,000 total, ₹2,000 paid from the shared pool so far.
  const taxiId = uid('cmt');
  const taxiPaymentTxId = uid('tx');
  goaTxs.push({
    id: taxiPaymentTxId,
    potId: goaId,
    type: 'pool_expense',
    description: 'Airport taxi booking fee',
    amount: 200000,
    category: 'Transport',
    paymentSource: 'pool',
    participants: allIds,
    splits: calculateExpenseShares(200000, allIds),
    splitMethod: 'equal',
    date: '2026-09-20',
    createdAt: '2026-09-20T10:00:00.000Z',
    createdBy: byName.Raj.id,
    note: 'Booking fee to hold the cab',
  });
  goaCommitments.push({
    id: taxiId,
    potId: goaId,
    title: 'Airport Taxi',
    vendorName: 'Goa Cabs Co.',
    category: 'Transport',
    totalAmount: 800000,
    dueDate: '2026-12-11',
    status: 'planned',
    createdBy: byName.Raj.id,
    createdAt: '2026-09-19T12:05:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  });
  goaCommitmentPayments.push({
    id: uid('cpay'),
    potId: goaId,
    commitmentId: taxiId,
    transactionId: taxiPaymentTxId,
    amount: 200000,
    createdAt: '2026-09-20T10:00:00.000Z',
  });

  // Cruise: ₹10,000 total, nothing paid yet — demonstrates the "planned, no payment" state.
  goaCommitments.push({
    id: uid('cmt'),
    potId: goaId,
    title: 'Cruise',
    vendorName: 'Mandovi River Cruises',
    category: 'Activities',
    totalAmount: 1000000,
    dueDate: '2026-12-12',
    status: 'planned',
    createdBy: byName.Raj.id,
    createdAt: '2026-09-19T12:10:00.000Z',
    updatedAt: '2026-09-19T12:10:00.000Z',
  });

  const goaPot: Pot = {
    id: goaId,
    name: 'Goa 2026',
    description: 'Annual friends trip to Goa',
    currency: 'INR',
    createdBy: byName.Raj.id,
    inviteCode: 'GOA7XK',
    inviteEnabled: true,
    joinCode: '7K2M9P',
    joinEnabled: true,
    status: 'active',
    createdAt: '2026-09-01',
    members: goaMembers,
  };

  // A pending join request waiting on Raj's review, matching the spec's worked example.
  const goaJoinRequests: JoinRequest[] = [
    {
      id: uid('jreq'),
      potId: goaId,
      userId: uid('user'),
      requestedName: 'Rajkumar Jangid',
      status: 'pending',
      linkedMemberId: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: '2026-09-20T10:00:00.000Z',
    },
  ];

  // ---------------- Manali 2027 ----------------
  const manaliId = 'manali';
  const manaliMembers = makeMembers(['Raj', 'Karan', 'Priya', 'Dev'], '2026-08-10');
  const mByName = Object.fromEntries(manaliMembers.map((m) => [m.name, m]));
  const manaliAll = manaliMembers.map((m) => m.id);
  const manaliTxs: Transaction[] = [];
  const pushManali = (t: Omit<Transaction, 'id' | 'potId' | 'createdAt'> & { date: string }) => {
    manaliTxs.push({ id: uid('tx'), potId: manaliId, createdAt: t.date, ...t });
  };

  manaliMembers.forEach((m) => {
    pushManali({
      type: 'contribution',
      description: 'Trip contribution',
      amount: 200000,
      paidBy: m.id,
      date: '2026-08-10',
      createdBy: m.id,
    });
  });

  pushManali({
    type: 'pool_expense',
    description: 'Hotel Manali',
    amount: 500000,
    category: 'Stay',
    paymentSource: 'pool',
    participants: manaliAll,
    splits: calculateExpenseShares(500000, manaliAll),
    splitMethod: 'equal',
    date: '2026-08-11',
    createdBy: mByName.Raj.id,
  });

  pushManali({
    type: 'member_expense',
    description: 'Paragliding',
    amount: 120000,
    category: 'Activities',
    paymentSource: 'personal',
    paidBy: mByName.Karan.id,
    participants: manaliAll.slice(0, 3),
    splits: calculateExpenseShares(120000, manaliAll.slice(0, 3)),
    splitMethod: 'equal',
    date: '2026-08-12',
    createdBy: mByName.Karan.id,
  });

  const manaliPot: Pot = {
    id: manaliId,
    name: 'Manali 2027',
    description: 'Mountain getaway',
    currency: 'INR',
    createdBy: mByName.Raj.id,
    inviteCode: 'MAN9QZ',
    inviteEnabled: true,
    joinCode: 'X92P4A', // no 0/1/O/I/L, matching JOIN_CODE_ALPHABET in src/logic/invites.ts
    joinEnabled: true,
    status: 'active',
    createdAt: '2026-08-10',
    members: manaliMembers,
  };

  // ---------------- Roommates (mostly empty) ----------------
  const roommatesId = 'roommates';
  const roommateMembers = makeMembers(['Raj', 'Vikas', 'Sahil'], '2026-09-10');
  const roommatesPot: Pot = {
    id: roommatesId,
    name: 'Roommates',
    description: 'Monthly house fund',
    currency: 'INR',
    createdBy: roommateMembers[0].id,
    inviteCode: 'ROOM3RT',
    inviteEnabled: true,
    joinCode: '4FZ8Q2',
    joinEnabled: true,
    status: 'active',
    createdAt: '2026-09-10',
    members: roommateMembers,
  };
  const roommatesTxs: Transaction[] = [];

  return {
    currentUser: CURRENT_USER,
    currentUserName: CURRENT_USER.name,
    pots: { [goaId]: goaPot, [manaliId]: manaliPot, [roommatesId]: roommatesPot },
    transactions: { [goaId]: goaTxs, [manaliId]: manaliTxs, [roommatesId]: roommatesTxs },
    joinRequests: { [goaId]: goaJoinRequests, [manaliId]: [], [roommatesId]: [] },
    commitments: { [goaId]: goaCommitments, [manaliId]: [], [roommatesId]: [] },
    commitmentPayments: { [goaId]: goaCommitmentPayments, [manaliId]: [], [roommatesId]: [] },
  };
}
