import type { PotSummaryViewModel } from '@/logic/pot-summary';
import { formatDateFull, formatMoney } from '@/utils/money';

/**
 * Renders the Pot Summary view-model as a print-ready HTML document for
 * expo-print (see src/app/pot/[id]/summary.tsx). Pure string templating only
 * — every number here already came out of buildPotSummaryViewModel, so this
 * file never computes money, it only formats and lays it out.
 */

const COLORS = {
  ink: '#1C1B19',
  inkSoft: '#6B6862',
  paper: '#F6F3EC',
  surface: '#FFFFFF',
  surfaceSunk: '#EFEBE1',
  line: '#E4DECF',
  accent: '#1F5F4E',
  pos: '#2E7D5B',
  neg: '#C1552F',
  gold: '#B8892B',
  goldSoft: '#F3E7C9',
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Full month name for the report header, e.g. "17 September 2026" — distinct from the app's short-month formatDateFull. */
function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function signedAmount(paise: number): string {
  return paise < 0 ? `-${formatMoney(Math.abs(paise))}` : formatMoney(paise);
}

function bar(pct: number, color: string): string {
  const clamped = Math.max(0, Math.min(100, pct));
  return `<div class="bar-track"><div class="bar-fill" style="width:${clamped}%;background:${color}"></div></div>`;
}

function section(title: string, body: string): string {
  return `<section class="section"><h2>${esc(title)}</h2>${body}</section>`;
}

function emptyNote(text: string): string {
  return `<p class="empty">${esc(text)}</p>`;
}

export function buildPotSummaryFilename(potName: string): string {
  const cleaned = potName
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return `Potto_${cleaned || 'Pot'}_Summary.pdf`;
}

export function buildPotSummaryHtml(vm: PotSummaryViewModel): string {
  const overview = `
    <div class="overview-grid">
      <div class="overview-item">
        <div class="overview-label">Total Contributed</div>
        <div class="overview-value">${formatMoney(vm.pool.contributed)}</div>
      </div>
      <div class="overview-item">
        <div class="overview-label">Total Spent</div>
        <div class="overview-value">${formatMoney(vm.pool.totalSpent)}</div>
      </div>
      <div class="overview-item">
        <div class="overview-label">Pool Balance</div>
        <div class="overview-value ${vm.pool.balance < 0 ? 'neg' : 'pos'}">${signedAmount(vm.pool.balance)}</div>
      </div>
      <div class="overview-item">
        <div class="overview-label">Number of Members</div>
        <div class="overview-value">${vm.memberCount}</div>
      </div>
    </div>
    <div class="compare-chart">
      <div class="compare-row">
        <span class="compare-label">Contributed</span>
        ${bar(vm.pool.totalSpent > 0 || vm.pool.contributed > 0 ? (vm.pool.contributed / Math.max(vm.pool.contributed, vm.pool.totalSpent, 1)) * 100 : 0, COLORS.pos)}
        <span class="compare-value">${formatMoney(vm.pool.contributed)}</span>
      </div>
      <div class="compare-row">
        <span class="compare-label">Spent</span>
        ${bar(vm.pool.totalSpent > 0 || vm.pool.contributed > 0 ? (vm.pool.totalSpent / Math.max(vm.pool.contributed, vm.pool.totalSpent, 1)) * 100 : 0, COLORS.neg)}
        <span class="compare-value">${formatMoney(vm.pool.totalSpent)}</span>
      </div>
    </div>
  `;

  const statusLines: string[] = [];
  statusLines.push(
    vm.status.poolBalanced
      ? '<div class="status-line ok">✓ Pool balanced</div>'
      : `<div class="status-line warn">⚠ Pool short by ${formatMoney(vm.status.poolShortfall)}</div>`,
  );
  statusLines.push(
    vm.upcoming.items.length === 0
      ? '<div class="status-line ok">✓ No outstanding payments</div>'
      : `<div class="status-line info">Upcoming: ${formatMoney(vm.status.upcomingRemaining)} remaining</div>`,
  );
  statusLines.push(
    vm.settlement.allSettled
      ? '<div class="status-line ok">✓ All members settled</div>'
      : '<div class="status-line warn">Settlement actions remaining</div>',
  );
  const potStatus = section('Pot Status', `<div class="status-block">${statusLines.join('')}</div>`);

  const potOverview = section('Pot Overview', overview);

  // ---- Member Contributions -------------------------------------------
  const hasExpectation = vm.contributions.expectedPerMember != null;
  let contributionsBody: string;
  if (vm.contributions.members.length === 0) {
    contributionsBody = emptyNote('No contributions yet.');
  } else {
    const maxContribution = Math.max(...vm.contributions.members.map((m) => m.total), 1);
    const rows = vm.contributions.members
      .map((m) => {
        const noteParts: string[] = [];
        if (hasExpectation) {
          if (m.expectation.status === 'on_track') noteParts.push('<span class="tag ok">✓ On track</span>');
          else if (m.expectation.status === 'above')
            noteParts.push(`<span class="tag ok">✓ ${formatMoney(m.expectation.difference)} above expected</span>`);
          else if (m.expectation.status === 'below') {
            noteParts.push(
              m.count === 0
                ? '<span class="tag warn">⚠ No contribution yet</span>'
                : `<span class="tag warn">⚠ ${formatMoney(-m.expectation.difference)} below expected</span>`,
            );
          }
        }
        return `
          <tr>
            <td class="name-cell">${esc(m.name)}</td>
            <td class="num-cell">${formatMoney(m.total)}</td>
            <td class="num-cell">${m.count}</td>
            <td class="note-cell">${noteParts.join('')}</td>
          </tr>`;
      })
      .join('');
    const chartRows = vm.contributions.members
      .map(
        (m) => `
          <div class="compare-row">
            <span class="compare-label">${esc(m.name)}</span>
            ${bar((m.total / maxContribution) * 100, hasExpectation && m.expectation.status === 'below' ? COLORS.gold : COLORS.accent)}
            <span class="compare-value">${formatMoney(m.total)}</span>
          </div>`,
      )
      .join('');
    contributionsBody = `
      <table class="data-table">
        <thead><tr><th>Member</th><th class="num-cell">Contributed</th><th class="num-cell">Contributions</th><th>Status</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td>Total</td>
            <td class="num-cell">${formatMoney(vm.contributions.total)}</td>
            <td class="num-cell">${vm.contributions.members.reduce((s, m) => s + m.count, 0)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="compare-chart">${chartRows}</div>
    `;
  }
  const memberContributions = section('Member Contributions', contributionsBody);

  // ---- Expense Summary --------------------------------------------------
  let expenseSummaryBody: string;
  if (vm.expenses.total === 0) {
    expenseSummaryBody = emptyNote('No pool expenses yet.');
  } else {
    const rows = vm.expenses.categories
      .map(
        (c) => `
          <div class="compare-row">
            <span class="compare-label">${esc(c.category)}</span>
            ${bar(c.percentage, COLORS.accent)}
            <span class="compare-value">${formatMoney(c.amount)} · ${c.percentage.toFixed(1)}%</span>
          </div>`,
      )
      .join('');
    expenseSummaryBody = `
      <div class="overview-item single">
        <div class="overview-label">Total Pool Expenses</div>
        <div class="overview-value">${formatMoney(vm.expenses.total)}</div>
      </div>
      <div class="compare-chart">${rows}</div>
    `;
  }
  const expenseSummary = section('Expense Summary', expenseSummaryBody);

  // ---- Expense Details ----------------------------------------------------
  let expenseDetailsBody: string;
  if (vm.expenses.items.length === 0) {
    expenseDetailsBody = emptyNote('No pool expenses yet.');
  } else {
    const rows = vm.expenses.items
      .map(
        (t) => `
          <tr>
            <td class="date-cell">${formatDateFull(t.date)}</td>
            <td class="name-cell">${esc(t.description)}${t.category ? `<span class="muted"> · ${esc(t.category)}</span>` : ''}</td>
            <td class="num-cell">${formatMoney(t.amount)}</td>
          </tr>`,
      )
      .join('');
    expenseDetailsBody = `
      <table class="data-table">
        <thead><tr><th>Date</th><th>Expense</th><th class="num-cell">Amount</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row"><td colspan="2">Total</td><td class="num-cell">${formatMoney(vm.expenses.total)}</td></tr>
        </tbody>
      </table>
    `;
  }
  const expenseDetails = section('Pool Expenses', expenseDetailsBody);

  // ---- Upcoming Payments --------------------------------------------------
  let upcomingBody: string;
  if (vm.upcoming.items.length === 0) {
    upcomingBody = emptyNote('No upcoming payments.');
  } else {
    const STATUS_LABEL: Record<string, string> = {
      planned: 'Planned',
      partially_paid: 'Partially Paid',
      fully_paid: 'Fully Paid',
      cancelled: 'Cancelled',
    };
    const rows = vm.upcoming.items
      .map(
        (c) => `
          <tr>
            <td class="name-cell">
              ${esc(c.vendorName || c.title)}
              ${c.vendorName && c.vendorName !== c.title ? `<span class="muted"> · ${esc(c.title)}</span>` : ''}
            </td>
            <td class="num-cell">${formatMoney(c.totalAmount)}</td>
            <td class="num-cell">${formatMoney(c.paid)}</td>
            <td class="num-cell">${formatMoney(c.remaining)}</td>
            <td class="date-cell">${c.dueDate ? formatDateFull(c.dueDate) : '—'}</td>
            <td class="note-cell">${esc(STATUS_LABEL[c.status] ?? c.status)}</td>
          </tr>`,
      )
      .join('');
    upcomingBody = `
      <div class="overview-item single">
        <div class="overview-label">Total Remaining</div>
        <div class="overview-value">${formatMoney(vm.upcoming.totalRemaining)}</div>
      </div>
      <table class="data-table">
        <thead><tr><th>Vendor / Title</th><th class="num-cell">Total</th><th class="num-cell">Paid</th><th class="num-cell">Remaining</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="footnote">Upcoming Payments are planned obligations — not included in Total Spent, Pool Balance, or Settlement.</p>
    `;
  }
  const upcoming = section('Upcoming Payments', upcomingBody);

  // ---- Member Balances ------------------------------------------------
  let balancesBody: string;
  if (vm.balances.length === 0) {
    balancesBody = emptyNote('No members.');
  } else {
    const rows = vm.balances
      .map((b) => {
        const label = b.balance === 0 ? 'Settled' : b.balance > 0 ? `Gets ${formatMoney(b.balance)}` : `Owes ${formatMoney(-b.balance)}`;
        const cls = b.balance === 0 ? '' : b.balance > 0 ? 'pos' : 'neg';
        return `
          <tr>
            <td class="name-cell">${esc(b.name)}${b.status === 'inactive' ? '<span class="muted"> · Removed</span>' : ''}</td>
            <td class="num-cell ${cls}">${label}</td>
          </tr>`;
      })
      .join('');
    balancesBody = `
      <table class="data-table">
        <thead><tr><th>Member</th><th class="num-cell">Position</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
  const balances = section('Member Balances', balancesBody);

  // ---- Settlement Plan ------------------------------------------------
  const poolFundingRows = vm.settlement.poolFunding.length
    ? vm.settlement.poolFunding
        .map(
          (p) => `
          <tr><td class="name-cell">${esc(p.name)} → Pool</td><td class="num-cell">${formatMoney(p.amount)}</td></tr>`,
        )
        .join('')
    : '';
  const memberTransferRows = vm.settlement.memberTransfers.length
    ? vm.settlement.memberTransfers
        .map(
          (t) => `
          <tr><td class="name-cell">${esc(t.fromName)} → ${esc(t.toName)}</td><td class="num-cell">${formatMoney(t.amount)}</td></tr>`,
        )
        .join('')
    : '';

  let settlementPlanBody: string;
  if (vm.settlement.allSettled) {
    settlementPlanBody = `
      <div class="status-block">
        <div class="status-line ok">✓ ALL SETTLED</div>
      </div>
      <div class="overview-grid">
        <div class="overview-item"><div class="overview-label">Pool Balance</div><div class="overview-value">${formatMoney(0)}</div></div>
        <div class="overview-item"><div class="overview-label">Outstanding</div><div class="overview-value">${formatMoney(0)}</div></div>
      </div>
    `;
  } else {
    settlementPlanBody = `
      <h3>Pool Funding</h3>
      ${
        poolFundingRows
          ? `<table class="data-table"><tbody>${poolFundingRows}
              <tr class="total-row"><td>Total Pool Funding Needed</td><td class="num-cell">${formatMoney(vm.settlement.poolFundingTotal)}</td></tr>
             </tbody></table>`
          : emptyNote('No pool funding needed.')
      }
      <h3>Member Settlement</h3>
      ${
        memberTransferRows
          ? `<table class="data-table"><tbody>${memberTransferRows}</tbody></table>`
          : emptyNote('Nothing to settle between members.')
      }
    `;
  }
  const settlementPlan = section('Settlement Plan — How Everyone Will Settle', settlementPlanBody);

  // ---- Settlement Progress ------------------------------------------------
  let progressBody: string;
  if (vm.settlement.allSettled) {
    progressBody = `<div class="status-block"><div class="status-line ok">✓ ALL SETTLED</div></div>`;
  } else {
    const fundingLine = `Pool Funding<br/><strong>${formatMoney(vm.settlement.poolFundingFunded)} / ${formatMoney(vm.settlement.poolFundingTarget)}</strong>`;
    const memberTotal = vm.settlement.memberSettlementCompleted + vm.settlement.memberSettlementOutstanding;
    const memberLine = `Member Settlement<br/><strong>${formatMoney(vm.settlement.memberSettlementCompleted)} / ${formatMoney(memberTotal)}</strong>`;
    const notes: string[] = [];
    if (vm.settlement.poolFundingTotal === 0 && vm.settlement.poolFundingTarget > 0) notes.push('✓ Pool funding complete');
    if (vm.settlement.memberSettlementOutstanding === 0 && memberTotal > 0) notes.push('✓ Member settlement complete');
    progressBody = `
      <div class="overview-grid">
        <div class="overview-item"><div class="overview-value small">${fundingLine}</div></div>
        <div class="overview-item"><div class="overview-value small">${memberLine}</div></div>
      </div>
      ${notes.length ? `<div class="status-block">${notes.map((n) => `<div class="status-line ok">${esc(n)}</div>`).join('')}</div>` : ''}
      <p class="footnote">Total outstanding ${formatMoney(vm.settlement.poolFundingTotal + vm.settlement.memberSettlementOutstanding)} — Pool Funding and Member Settlement are two separate, non-overlapping stages; the Pool shortfall is never counted twice.</p>
    `;
  }
  const settlementProgress = section('Settlement Progress', progressBody);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(vm.potName)} — Pot Summary</title>
<style>
  @page { size: A4; margin: 28px 30px; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: ${COLORS.inkSoft}; } }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    color: ${COLORS.ink};
    background: ${COLORS.paper};
    margin: 0;
    padding: 24px 28px 40px;
    font-size: 12px;
    line-height: 1.5;
  }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${COLORS.ink}; padding-bottom: 14px; margin-bottom: 6px; }
  .brand { font-size: 12px; letter-spacing: 2px; font-weight: 700; color: ${COLORS.accent}; }
  .doc-title { font-size: 22px; font-weight: 700; margin-top: 2px; }
  .pot-name { font-size: 16px; font-weight: 600; margin-top: 10px; color: ${COLORS.accent}; }
  .meta { text-align: right; font-size: 11px; color: ${COLORS.inkSoft}; }
  .meta div { margin-bottom: 2px; }
  section.section { margin-top: 22px; page-break-inside: avoid; }
  h2 { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: ${COLORS.inkSoft}; border-bottom: 1px solid ${COLORS.line}; padding-bottom: 6px; margin: 0 0 12px; }
  h3 { font-size: 12px; margin: 14px 0 8px; color: ${COLORS.ink}; }
  .overview-grid { display: flex; flex-wrap: wrap; gap: 14px; }
  .overview-item { flex: 1 1 45%; background: ${COLORS.surface}; border: 1px solid ${COLORS.line}; border-radius: 8px; padding: 12px 14px; }
  .overview-item.single { flex-basis: 100%; margin-bottom: 12px; }
  .overview-label { font-size: 10px; letter-spacing: 0.5px; color: ${COLORS.inkSoft}; text-transform: uppercase; }
  .overview-value { font-size: 19px; font-weight: 700; margin-top: 4px; }
  .overview-value.small { font-size: 12px; font-weight: 400; line-height: 1.7; }
  .overview-value.pos { color: ${COLORS.pos}; }
  .overview-value.neg { color: ${COLORS.neg}; }
  .compare-chart { margin-top: 14px; }
  .compare-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; page-break-inside: avoid; }
  .compare-label { flex: 0 0 110px; font-size: 11px; color: ${COLORS.ink}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1 1 auto; height: 10px; background: ${COLORS.surfaceSunk}; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; }
  .compare-value { flex: 0 0 120px; text-align: right; font-size: 11px; font-weight: 600; }
  table.data-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.data-table th { text-align: left; font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; color: ${COLORS.inkSoft}; border-bottom: 1px solid ${COLORS.ink}; padding: 6px 8px; }
  table.data-table td { padding: 7px 8px; border-bottom: 1px solid ${COLORS.line}; font-size: 11.5px; page-break-inside: avoid; word-break: break-word; }
  table.data-table tr { page-break-inside: avoid; }
  .num-cell { text-align: right; white-space: nowrap; }
  th.num-cell { text-align: right; }
  .name-cell { max-width: 220px; }
  .date-cell { white-space: nowrap; color: ${COLORS.inkSoft}; }
  .note-cell { white-space: nowrap; }
  .muted { color: ${COLORS.inkSoft}; font-size: 10.5px; }
  .total-row td { font-weight: 700; border-top: 1.5px solid ${COLORS.ink}; border-bottom: none; }
  .tag { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 5px; }
  .tag.ok { color: ${COLORS.pos}; }
  .tag.warn { color: ${COLORS.gold}; background: ${COLORS.goldSoft}; }
  .num-cell.pos { color: ${COLORS.pos}; font-weight: 600; }
  .num-cell.neg { color: ${COLORS.neg}; font-weight: 600; }
  .status-block { display: flex; flex-wrap: wrap; gap: 10px; }
  .status-line { font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 6px; background: ${COLORS.surface}; border: 1px solid ${COLORS.line}; }
  .status-line.ok { color: ${COLORS.pos}; }
  .status-line.warn { color: ${COLORS.gold}; }
  .status-line.info { color: ${COLORS.ink}; }
  .empty { color: ${COLORS.inkSoft}; font-style: italic; font-size: 11.5px; }
  .footnote { font-size: 10px; color: ${COLORS.inkSoft}; margin-top: 10px; }
  .doc-footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid ${COLORS.line}; font-size: 9.5px; color: ${COLORS.inkSoft}; text-align: center; }
</style>
</head>
<body>
  <div class="masthead">
    <div>
      <div class="brand">POTTO</div>
      <div class="doc-title">Pot Summary</div>
      <div class="pot-name">${esc(vm.potName)}</div>
    </div>
    <div class="meta">
      <div>Generated: ${formatDateLong(vm.generatedAt)}</div>
      <div>Members: ${vm.memberCount}</div>
    </div>
  </div>

  ${potOverview}
  ${potStatus}
  ${memberContributions}
  ${expenseSummary}
  ${expenseDetails}
  ${upcoming}
  ${balances}
  ${settlementPlan}
  ${settlementProgress}

  <div class="doc-footer">${esc(vm.potName)} · Potto Pot Summary · Generated ${formatDateLong(vm.generatedAt)}</div>
</body>
</html>`;
}
