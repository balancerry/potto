import { calculatePoolBalance } from '@/logic/accounting';
import { calculateAccountBalance, reconciliationGap } from '@/logic/pool-money';
import type { PoolAccount, Transaction } from '@/types/models';

const bank: PoolAccount = {
  id: 'bank',
  potId: 'p',
  name: 'Pool Bank',
  type: 'bank',
  currency: 'INR',
  active: true,
  isDefault: true,
};
const cash: PoolAccount = {
  id: 'cash',
  potId: 'p',
  name: 'Pool Cash',
  type: 'cash',
  currency: 'INR',
  active: true,
  isDefault: true,
};

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount'>): Transaction {
  return {
    potId: 'p',
    description: partial.type,
    date: '2026-09-25',
    createdAt: '2026-09-25T00:00:00.000Z',
    createdBy: 'sunil',
    ...partial,
  };
}

describe('pool account balances', () => {
  const transactions = [
    tx({ id: 'c1', type: 'contribution', amount: 500000, paidBy: 'mona', poolAccountId: 'cash', receivedVia: 'cash' }),
    tx({ id: 'c2', type: 'contribution', amount: 500000, paidBy: 'sunil', poolAccountId: 'bank', receivedVia: 'online' }),
    tx({ id: 'e1', type: 'pool_expense', amount: 200000, poolAccountId: 'bank', paymentSource: 'pool' }),
    tx({ id: 'e2', type: 'member_expense', amount: 300000, paidBy: 'sunil', paymentSource: 'personal' }),
    tx({ id: 't1', type: 'pool_transfer', amount: 100000, poolAccountId: 'bank', toPoolAccountId: 'cash' }),
  ];

  it('keeps total pool unchanged by transfers and ignores personal expenses', () => {
    expect(calculatePoolBalance(transactions)).toBe(800000);
    expect(calculateAccountBalance(transactions, 'bank')).toBe(200000);
    expect(calculateAccountBalance(transactions, 'cash')).toBe(600000);
    expect(reconciliationGap([bank, cash], transactions)).toBe(0);
  });
});
