import type { PoolAccount, Transaction } from '@/types/models';

export function activityDetail(
  tx: Transaction,
  memberName: (id?: string) => string,
  accountName: (id?: string) => string,
): string {
  if (tx.type === 'contribution') {
    const via = tx.receivedVia === 'cash' ? 'Cash' : 'Online';
    return `${memberName(tx.paidBy)} added ${via} → ${accountName(tx.poolAccountId)}`;
  }
  if (tx.type === 'pool_expense') return `Paid from ${accountName(tx.poolAccountId)}`;
  if (tx.type === 'member_expense') return `${memberName(tx.paidBy)} paid personally`;
  if (tx.type === 'pool_transfer') {
    return `${accountName(tx.poolAccountId)} → ${accountName(tx.toPoolAccountId)}`;
  }
  if (tx.type === 'settlement') return `${memberName(tx.paidBy)} → ${memberName(tx.toMember)}`;
  return '';
}
import { calculatePoolBalance } from '@/logic/accounting';

/** Signed effect of one ledger row on one pool account. Transfers net to zero across accounts. */
export function accountEffect(tx: Transaction, accountId: string): number {
  if (tx.type === 'contribution' && tx.poolAccountId === accountId) return tx.amount;
  if (tx.type === 'pool_transfer' && tx.toPoolAccountId === accountId) return tx.amount;
  if (tx.type === 'pool_expense' && tx.poolAccountId === accountId) return -tx.amount;
  if (tx.type === 'pool_transfer' && tx.poolAccountId === accountId) return -tx.amount;
  return 0;
}

export function calculateAccountBalance(transactions: Transaction[], accountId: string): number {
  return transactions.reduce((sum, tx) => sum + accountEffect(tx, accountId), 0);
}

export function calculateAccountBalances(
  accounts: PoolAccount[],
  transactions: Transaction[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const account of accounts) {
    balances[account.id] = calculateAccountBalance(transactions, account.id);
  }
  return balances;
}

export function defaultAccountFor(
  accounts: PoolAccount[],
  receivedVia: 'online' | 'cash',
): PoolAccount | undefined {
  const type = receivedVia === 'cash' ? 'cash' : 'bank';
  return (
    accounts.find((a) => a.active && a.isDefault && a.type === type) ??
    accounts.find((a) => a.active && a.type === type)
  );
}

/** Pool Bank + Pool Cash should equal pool balance. Difference is a warning, never an auto-fix. */
export function reconciliationGap(accounts: PoolAccount[], transactions: Transaction[]): number {
  const accountTotal = accounts
    .filter((a) => a.active)
    .reduce((sum, a) => sum + calculateAccountBalance(transactions, a.id), 0);
  return accountTotal - calculatePoolBalance(transactions);
}
