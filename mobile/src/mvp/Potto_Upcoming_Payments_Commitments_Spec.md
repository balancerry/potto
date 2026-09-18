# Potto Upcoming Payments & Commitments Specification

## 1. Overview

Potto needs to track **planned financial obligations** that the group has agreed to pay but has not necessarily paid in full yet.

Example:

A hotel costs ₹42,000 for 3 days. The group has already paid ₹20,000 as an advance.

Potto should show:

```text
Hotel
₹42,000 total
₹20,000 paid
₹22,000 remaining
```

This feature is **inside each Pot** and should be called **Upcoming Payments** in the user-facing UI. The internal/domain concept can be called a **Commitment**.

## 2. Core Concept

A Commitment represents: "We expect/agreed to pay this amount to this vendor."

It is **not itself an expense**.

Actual money movement continues through Potto's existing transaction/accounting system.

```text
Commitment
    ↓
Commitment Payment
    ↓
Existing Actual Transaction
```

The existing transaction ledger remains the source of truth for actual money movement.

## 3. Critical Accounting Rule

Creating a Commitment must NOT change:

- Pool balance
- Total spent
- Member balances
- Contributions
- Settlements

Only an actual payment/transaction changes accounting.

## 4. Commitment vs Transaction

### Commitment

Planned/agreed obligation:

```text
Hotel
₹42,000
Due Dec 10
```

### Actual Payment

Money actually paid:

```text
₹20,000
```

### Transaction

The actual accounting event.

- Pool payment → existing Pool Expense
- Member payment → existing Member-paid Expense

### Settlement

Member-to-member repayment.

A Commitment must NOT directly create a Settlement.

## 5. Data Model

Inspect the existing database first. If an equivalent model does not exist, support:

```text
commitments
------------
id
pot_id
title
vendor_name
category
description
total_amount
due_date
status
created_by
created_at
updated_at
```

```text
commitment_payments
-------------------
id
commitment_id
transaction_id
amount
created_at
```

Use existing project naming conventions. Do not create duplicate concepts.

## 6. Transaction Relationship

A `commitment_payment` associates an actual existing transaction with a Commitment.

Example:

```text
Transaction:
₹20,000 Hotel Expense

Commitment:
Sea View Resort
₹42,000

Commitment Payment:
₹20,000
```

Do NOT create a second financial transaction for the Commitment.

There should be exactly one actual transaction for each real payment.

## 7. Payment Calculation

Conceptually:

```text
remaining = total_amount - SUM(commitment_payments.amount)
```

Use integer paise internally and the existing centralized currency formatter.

## 8. Commitment Status

Support:

```text
planned
partially_paid
fully_paid
cancelled
```

Example progression:

```text
₹42,000 total
₹0 paid
₹42,000 remaining
Planned
```

then:

```text
₹42,000 total
₹20,000 paid
₹22,000 remaining
Partially Paid
```

then:

```text
₹42,000 total
₹42,000 paid
₹0 remaining
Fully Paid
```

## 9. Create Commitment First

Allow creating an Upcoming Payment without making a payment.

Example:

```text
+ Add Upcoming Payment

Title: Hotel
Vendor: Sea View Resort
Total Amount: ₹42,000
Due Date: 10 Dec 2026
Category: Accommodation
Notes: 3 nights

[Save]
```

Creating it must not affect Pool balance or Total Spent.

## 10. Add Payment to Existing Commitment

Reuse the existing Add Expense flow where possible.

Example:

```text
+ Add Expense

Amount: ₹20,000
Category: Hotel
Paid From: Pool

Related Upcoming Payment:
Sea View Resort
₹42,000 total
₹42,000 remaining

[Save]
```

The existing expense system creates the actual Pool Expense. Then create/link the `commitment_payment` to that transaction.

Result:

```text
Sea View Resort
₹42,000 total
₹20,000 paid
₹22,000 remaining
Partially Paid
```

## 11. Member-Paid Commitment Payment

A Commitment payment may be paid personally by a member.

Example:

```text
Hotel: ₹42,000
Raj personally pays: ₹20,000
```

Use the existing Member-paid Expense flow and link that transaction to the Commitment.

The Pool balance must NOT decrease because Raj paid personally. Raj's existing balance calculation must work normally.

## 12. Create Commitment While Adding Expense

Do not force users to create the Commitment separately.

During Add Expense, allow:

```text
Is this payment related to an Upcoming Payment?

[Link Existing]
[Create New]
[No]
```

If `Create New`:

```text
Create Upcoming Payment

Vendor: Sea View Resort
Total Agreed Amount: ₹42,000
Due Date: 10 Dec 2026
Current Payment: ₹20,000

[Save]
```

This should create:

1. Commitment
2. Actual transaction
3. Commitment payment linking the transaction

Prefer a transactional/server-side operation to avoid partial/inconsistent state.

## 13. Multiple Payments

A Commitment can have multiple payments.

Example:

```text
Hotel
Total: ₹42,000

Payment #1: ₹20,000
Payment #2: ₹10,000
Payment #3: ₹12,000
```

Result:

```text
Total: ₹42,000
Paid: ₹42,000
Remaining: ₹0
Status: Fully Paid
```

Each payment references its actual transaction.

## 14. Payment History

Commitment detail should show payment history:

```text
Sea View Resort

₹42,000 total
₹20,000 paid
₹22,000 remaining

Due: 10 Dec 2026
Status: Partially Paid

Payment History

₹20,000
Dec 1
Paid by Raj
Pool

[Add Payment]
[Edit]
[Cancel]
```

`Add Payment` should use the existing Add Expense/payment flow where possible.

## 15. Upcoming Payments Screen

Inside the Pot:

```text
Upcoming Payments

🏨 Sea View Resort
₹42,000 total
₹20,000 paid
₹22,000 remaining
Due Dec 10

🚐 Airport Taxi
₹8,000 total
₹2,000 paid
₹6,000 remaining
Due Dec 11

🎟 Cruise
₹10,000 total
₹0 paid
₹10,000 remaining
Due Dec 12

[+ Add Upcoming Payment]
```

Fully paid and cancelled commitments may remain accessible in history.

## 16. Pot Dashboard Integration

Add a lightweight summary:

```text
Goa 2026

Pool Balance
₹30,000

Total Spent
₹20,000

Upcoming Payments
₹55,000

Hotel
₹22,000 remaining
Due Dec 10

Taxi
₹5,000 remaining
Due Dec 11

[View All]
```

Upcoming Payments must NOT be included in Total Spent.

## 17. Potential Pool Shortfall

Optionally derive:

```text
Pool Balance: ₹30,000
Upcoming Remaining Commitments: ₹55,000
Potential Shortfall: ₹25,000
```

This is informational only. Do not create a debt transaction, member balance, settlement, or automatic contribution.

Suggested wording:

```text
Upcoming commitments exceed current pool balance by ₹25,000.
You may need additional contributions.
```

If this complicates MVP, leave it out while keeping the architecture extensible.

## 18. Due Dates

A Commitment can have a due date.

Derive display states such as:

```text
Upcoming
Due Soon
Due Today
Overdue
Paid
Cancelled
```

Do not unnecessarily store derived display state if it can be calculated from due date, remaining amount and status.

## 19. Edit Commitment

Allow editing:

- title
- vendor
- category
- description
- total amount
- due date

Example:

```text
Original total: ₹42,000
Updated total: ₹43,500
Paid: ₹20,000
Remaining: ₹23,500
```

Historical transactions must not be modified when the Commitment total changes.

## 20. Cancel Commitment

A Commitment can be cancelled.

Set:

```text
status = cancelled
```

Do not automatically delete it or its financial transactions.

If payments exist, keep them. Handle refunds through the existing refund/reversal accounting system.

## 21. Refund

Example:

```text
Hotel total: ₹42,000
Paid: ₹20,000
Refund: ₹15,000
```

Do not delete the original payment transaction. Use the existing refund/reversal model. Do not create an artificial expense.

## 22. Commitment vs Settlement

Never connect a Commitment directly to a Settlement.

Correct relationship:

```text
Commitment
    ↓
Member-paid Expense
    ↓
Existing balance engine
    ↓
Settlement
```

## 23. Overpayment

For MVP, do not allow payment to exceed remaining amount.

Example:

```text
Total: ₹42,000
Paid: ₹40,000
Remaining: ₹2,000
```

Attempting ₹5,000 should show:

```text
Payment exceeds remaining commitment amount by ₹3,000.
```

## 24. Categories

Reuse existing Potto expense categories. Possible categories include:

```text
Accommodation
Transport
Food
Activity
Event
Photography
Venue
Other
```

Do not introduce a duplicate category system.

## 25. Permissions

Use the existing Pot role/access system.

### Admin
- create commitments
- edit commitments
- cancel commitments
- add/link payments
- view all

### Member
- view commitments
- create commitments if existing expense permissions allow
- add/link their own payments according to existing permissions

### View Only
- view commitments
- cannot create/edit/cancel/add payments

Permissions must be enforced server-side.

## 26. Multiple Pots

Commitments belong to exactly one Pot.

Every Commitment must have `pot_id`.

No cross-Pot payment linking.

## 27. Transaction Edit/Delete

Follow existing Potto transaction rules.

If a linked transaction is deleted, its Commitment payment must no longer count toward Paid.

Example:

```text
Before:
Paid ₹20,000
Remaining ₹22,000

Delete actual ₹20,000 transaction

After:
Paid ₹0
Remaining ₹42,000
```

Do not leave orphaned commitment payments.

If a Commitment is cancelled/deactivated, historical transactions remain.

## 28. Money Handling

Use integer paise internally.

```text
₹42,000 = 4,200,000 paise
₹20,000 = 2,000,000 paise
Remaining = 2,200,000 paise = ₹22,000
```

Reuse Potto's centralized formatter.

## 29. Edge Cases

Handle:

1. No payments
2. One payment
3. Multiple payments
4. Fully paid
5. Partially paid
6. Cancelled
7. Deleted linked transaction
8. Edited linked transaction
9. Increased total
10. Decreased total
11. Overpayment
12. Due date passed
13. No due date
14. Pool payment
15. Member payment
16. Multiple members paying
17. Refund
18. Archived Pot
19. Removed member
20. Unauthorized user
21. Concurrent payment creation
22. Duplicate payment submission
23. Network failure
24. Commitment created but transaction fails
25. Transaction created but commitment link fails
26. Cross-Pot linking attempt
27. Same transaction linked twice

Critical operations must be transactional where required.

## 30. Security

Server-side checks must verify:

- Commitment belongs to requested Pot
- Payment belongs to same Pot
- Transaction belongs to same Pot
- User has permission
- Payment amount is valid
- Cancelled commitments cannot receive prohibited payments
- Transaction cannot be linked to another Pot's Commitment
- Duplicate relationships are prevented

Use existing Supabase/Postgres RLS and server-side patterns.

## 31. Realtime

If Potto uses Supabase Realtime, integrate commitments into the existing query/cache/realtime architecture for:

- Commitment creation/edit/cancellation
- Payment creation/deletion
- Transaction edit/delete
- Fully paid transitions

Do not introduce another state-management architecture.

## 32. Future Extensibility

Keep the architecture extensible for:

- scheduled payments
- vendor history
- receipts/attachments
- cancellation fees
- refunds
- estimated vs confirmed commitments
- recurring commitments
- reminders/notifications
- budget planning
- analytics

Do not implement all future features now.

## 33. Recommended UX

Support both:

### Commitment first

```text
Add Upcoming Payment
    ↓
Hotel ₹42,000
    ↓
Later pay ₹20,000
    ↓
Link payment
```

### Expense first

```text
Add Expense
    ↓
₹20,000 Hotel
    ↓
Related Upcoming Payment?
    ↓
Link Existing / Create New / No
```

Both paths use the same underlying Commitment + Transaction relationship.

## 34. Complete Verification Scenario

Pot: Goa 2026

Create:

```text
Hotel
Sea View Resort
Total ₹42,000
Due Dec 10
```

Expected:

```text
Upcoming: ₹42,000
Pool balance: unchanged
Total spent: unchanged
```

Raj personally pays ₹20,000:

```text
Member-paid Expense
Hotel
₹20,000
Paid by Raj
```

Link it to the hotel Commitment.

Expected:

```text
Commitment:
₹42,000 total
₹20,000 paid
₹22,000 remaining
```

Pool balance remains unchanged by Raj's personal payment.

Then Pot pays remaining ₹22,000:

```text
Pool Expense
Hotel
₹22,000
```

Link it to the same Commitment.

Expected:

```text
Commitment:
₹42,000 total
₹42,000 paid
₹0 remaining
Fully Paid
```

Actual financial transactions must be exactly:

1. Member-paid Expense ₹20,000
2. Pool Expense ₹22,000

There must NOT be a third ₹42,000 transaction.

## 35. Architecture Summary

```text
                         POT
                          │
              ┌───────────┴───────────┐
              │                       │
        ACTUAL LEDGER            COMMITMENTS
              │                       │
       ┌──────┼──────┐          Hotel ₹42K
       │      │      │                │
Contribution Expense Settlement       │
              │                  ┌────┴────┐
              │                  │         │
              │               Payment    Payment
              │                ₹20K       ₹22K
              │                  │         │
              └──────────────────┴─────────┘
                         │
                   Actual Transactions
```

Core principle:

> **Commitment = planned obligation. Transaction = actual money movement.**

Commitment Payments connect the two.

## 36. Definition of Done

The feature is complete when a Pot user can:

1. Create an Upcoming Payment.
2. See total amount.
3. See amount paid.
4. See remaining amount.
5. See due date.
6. Add multiple payments.
7. Link each payment to an actual transaction.
8. Create a Commitment while adding an Expense.
9. Pay from the Pool.
10. Pay personally as a member.
11. View payment history.
12. Edit the Commitment.
13. Cancel the Commitment.
14. Handle refunds without deleting history.
15. Prevent overpayment.
16. See Upcoming Payments inside the Pot.
17. See a dashboard summary.
18. Keep actual accounting separate from planned obligations.
19. Maintain correct Pool and Member balances.
20. Keep Pots isolated.
21. Preserve historical transactions.
22. Enforce permissions server-side.
23. Handle failures and concurrent operations safely.

Existing accounting, settlement, member, invitation, Join Code and QR systems must continue working without regression.
