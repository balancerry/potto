# Trip Wallet - Product Specification & MVP Reference

## 1. Product Overview

**Trip Wallet** is a lightweight shared-money management application for groups.

It is not limited to Goa or travel. A user can create multiple trips/events/groups and invite different people into each one.

Examples:
- Goa Trip 2026
- Manali Trip
- Family Vacation
- Bachelor Party
- Wedding Expenses
- Office Outing
- Friends Dinner Group
- Monthly House Trip
- Any temporary group fund

### Core problem

Groups frequently collect money from members, pay shared expenses, and then struggle to answer:

- How much money is currently in the common pool?
- Who contributed how much?
- Where did the money go?
- Who paid an expense?
- Who participated in an expense?
- How much has each person effectively consumed?
- Who needs to pay more?
- Who should receive money?
- What exact transfers are needed to settle everyone?

Trip Wallet provides one transparent, shared ledger for all of this.

---

# 2. Product Principles

1. **Transparency first**
   Every member should be able to see the group's financial history.

2. **Pool and expense are different concepts**
   A contribution is money entering the common pool. An expense is money leaving the pool or a group expense paid personally by a member.

3. **Who paid and who consumed are independent**
   A person can pay for an expense without being the only person responsible for it.

4. **No hidden calculations**
   Every balance should be explainable from recorded transactions.

5. **Multiple trips**
   A user can belong to multiple trips simultaneously.

6. **Low friction**
   Joining a trip should require only an invite link/QR and a name in the MVP.

7. **Realtime shared state**
   When one member adds a transaction, other members should see the updated ledger without manually refreshing.

8. **Financial correctness over UI complexity**
   The accounting engine should be deterministic and independently testable.

---

# 3. Main Product Model

The hierarchy is:

User
→ Trips
→ Members
→ Transactions
→ Transaction Splits
→ Balances
→ Settlement

A user can create multiple trips.

A trip has multiple members.

A member can belong to multiple trips.

Each trip has an independent ledger.

Example:

Raj
├── Goa 2026
│   ├── Raj
│   ├── Amit
│   └── Neha
│
├── Manali 2027
│   ├── Raj
│   ├── Karan
│   └── Priya
│
└── Family Vacation
    ├── Raj
    ├── Mother
    └── Father

Transactions from one trip must never affect another trip.

---

# 4. User Roles

## Trip Admin

The person who creates the trip.

Permissions:
- Create trip
- Edit trip details
- Generate/share invite
- View all members
- Remove members
- Add/edit/delete transactions
- Correct mistakes
- Manage trip settings
- Close/archive trip
- Generate final settlement

## Trip Member

Permissions:
- Join trip
- View dashboard
- View complete transaction history
- Add contribution
- Add expense
- View members
- View own balance
- View settlement
- Edit/delete transactions they created, subject to product rules

For MVP, admin has final authority over corrections.

## Future roles

Potential future role:
- Viewer/read-only member

Not required for MVP.

---

# 5. Trip Creation

User taps:

**Create Trip**

Fields:

- Trip name
- Optional description
- Currency
- Start date
- End date
- Optional trip image

Example:

Goa Trip 2026

Currency:
INR

Start:
7 Oct 2026

End:
12 Oct 2026

After creation, the creator becomes Admin.

The app generates:
- Trip ID
- Unique invite code
- Shareable invite link
- QR code

Example invite:

https://tripwallet.app/join/GOA7XK

---

# 6. Multiple Trips

The home screen should show all trips.

Example:

## My Trips

### Goa 2026
17 members
Pool: ₹31,300

### Manali 2027
8 members
Pool: ₹12,500

### Wedding Group
12 members
Pool: ₹74,000

Each trip opens its own dashboard.

There must be a clear:

**+ Create Trip**

button.

A user should never need to leave one trip to create another.

---

# 7. Joining a Trip

## Primary method

Share invite link.

Example:

https://tripwallet.app/join/GOA7XK

The link can be shared through:
- WhatsApp
- Telegram
- SMS
- Email
- Copy link

## QR method

Trip Admin can show a QR code.

Friends scan it and join.

## MVP onboarding

After opening the invite:

Join Goa 2026

Name:
[ Amit ]

[ Join Trip ]

The user does not need a complicated account creation flow for the first MVP.

Later authentication can be added using:
- Google
- Apple
- Phone OTP
- Email

---

# 8. Trip Dashboard

The dashboard is the primary screen.

Example:

GOA 2026

POOL BALANCE
₹31,300

Contributed
₹85,000

Spent
₹53,700

Members
17

Transactions
24

Primary actions:

[ + Contribution ]

[ + Expense ]

Recent activity appears below.

Example:

Raj
Contribution
+₹5,000

Villa Booking
Pool Expense
-₹35,000

Amit
Contribution
+₹5,000

Dinner
Pool Expense
-₹8,500

The dashboard should prioritize the current pool balance.

---

# 9. Financial Concepts

There are four major transaction concepts.

## 9.1 Contribution

Money entering the common pool.

Example:

Raj contributes ₹5,000.

Effect:

Pool +₹5,000

Raj's contribution total +₹5,000

This is NOT an expense.

---

## 9.2 Pool Expense

Money directly leaving the common pool.

Example:

Hotel costs ₹35,000 and is paid from the common pool.

Effect:

Pool -₹35,000

The expense must specify participants.

---

## 9.3 Member-Paid Expense

A member pays a group expense from their own money.

Example:

Raj personally pays ₹10,000 for dinner.

The transaction records:

Paid by:
Raj

Expense:
₹10,000

Participants:
Selected group members

The group accounting must credit Raj for the amount he paid while assigning the expense shares to participants.

This distinction is essential.

---

## 9.4 Settlement

Money transferred between members to settle outstanding balances.

Example:

Amit → Raj ₹2,200

A settlement is not a new group expense.

It closes/reduces an existing balance.

---

# 10. Add Contribution Flow

User taps:

**+ Contribution**

Fields:

- Person
- Amount
- Payment method
- Note
- Date

Example:

Person:
Raj

Amount:
₹5,000

Method:
UPI

Note:
Initial contribution

Save.

The dashboard updates immediately.

---

# 11. Add Expense Flow

User taps:

**+ Expense**

Fields:

- Description
- Amount
- Paid by
- Expense source
- Category
- Participants
- Split method
- Date
- Optional note
- Optional receipt/photo

Example:

Description:
Dinner

Amount:
₹8,500

Paid by:
Raj

Source:
Personal payment

Category:
Food

Participants:
Raj, Amit, Neha, Karan

Split:
Equal

The app calculates each person's share.

If 4 people participate:

₹8,500 / 4 = ₹2,125 each.

Raj paid ₹8,500 but consumed ₹2,125.

Therefore Raj receives credit for the other participants' shares.

---

# 12. Expense Categories

Default categories:

- Stay
- Food
- Transport
- Activities
- Tickets
- Shopping
- Fuel
- Groceries
- Drinks
- Miscellaneous

Admin/user can add custom categories later.

---

# 13. Split Methods

The app should support:

## Equal

Example:
₹9,000 / 6 people

Each:
₹1,500

## Custom Amount

Example:

Raj ₹2,000
Amit ₹1,500
Neha ₹2,500
Karan ₹3,000

Total must equal expense amount.

## Percentage

Example:

Raj 25%
Amit 25%
Neha 50%

Percentages must total 100%.

## Future option: Quantity

Useful for:
- Hotel rooms
- Tickets
- Food quantities
- Vehicle seats

Not necessary for first MVP.

---

# 14. Transaction History

Every trip has a complete chronological ledger.

Filters:

- All
- Contributions
- Pool Expenses
- Member Expenses
- Settlements

Each transaction displays:

- Date
- Description
- Type
- Amount
- Person
- Category
- Participants if relevant

Example:

16 Sep

Raj
Contribution
+₹5,000

16 Sep

Villa
Pool Expense
-₹35,000

17 Sep

Dinner
Member Expense
₹8,500
Paid by Raj

17 Sep

Amit → Raj
Settlement
₹2,200

---

# 15. Transaction Details

Tapping a transaction opens details.

Example:

DINNER

₹8,500

Paid by:
Raj

Category:
Food

Date:
17 Sep

Participants:

Raj       ₹2,125
Amit      ₹2,125
Neha      ₹2,125
Karan     ₹2,125

Total:
₹8,500

Actions:
- Edit
- Delete

Admin can correct transactions.

---

# 16. Pool Balance

The basic pool balance is:

Total Contributions
-
Pool Expenses
+
Pool Refunds
-
Other pool outflows

Example:

Contributions:
₹85,000

Pool expenses:
₹53,700

Pool balance:
₹31,300

Important:

A member-paid expense does NOT reduce the actual pool cash unless the pool later reimburses that member.

---

# 17. Individual Balance

The system must distinguish:

### Actual pool cash

Money physically/currently available in the shared pool.

### Individual settlement balance

Money that each person should ultimately pay or receive after accounting for:
- Contributions
- Expense shares
- Member-paid expenses
- Reimbursements
- Settlements

Do not confuse these two numbers.

---

# 18. Balance Explanation

Every member should be able to tap their balance and see exactly why it exists.

Example:

RAJ

Contributed:
₹10,000

Raj's expense share:
₹7,200

Additional group expenses paid personally:
₹4,000

Current net position:
+₹6,800

Then show the underlying transactions.

This is important for trust and dispute resolution.

---

# 19. Final Settlement

When the trip is finished:

Admin taps:

**Final Settlement**

The system calculates all member balances.

Positive:
Member should receive money.

Negative:
Member should pay money.

Example:

Raj +₹3,250
Neha +₹1,800
Amit -₹2,100
Karan -₹1,450

Then generate transfers.

Example:

Amit → Raj ₹2,100
Karan → Raj ₹1,150
Karan → Neha ₹300
...

The settlement engine should minimize the number of transfers.

---

# 20. Settlement Requirements

The algorithm must guarantee:

Total money paid by debtors
=
Total money received by creditors

It must not introduce or lose money due to rounding.

Use integer paise internally where appropriate.

Example:

₹708.33 should be represented internally as:

70833 paise

Avoid floating point arithmetic for financial calculations.

---

# 21. Settlement Status

Each settlement can have:

- Pending
- Paid
- Confirmed

Example:

Amit → Raj ₹2,200

Pending

Amit taps:

**Mark as Paid**

Raj can then:

**Confirm Received**

This is a future enhancement but useful after the MVP.

---

# 22. Home Screen

Global home screen:

Trip Wallet

My Trips

Goa 2026
17 members
₹31,300 pool

Manali 2027
8 members
₹12,500 pool

[ + Create Trip ]

[ Join Trip ]

---

# 23. Trip Navigation

Recommended tabs:

Home
Transactions
Members
Settlement

Possible additional:
Settings

The primary Add button can float above the navigation:

+

When tapped:

Add Contribution
Add Expense

---

# 24. Members Screen

Show:

17 Members

Raj
Admin

Amit
Member

Neha
Member

...

For each member optionally show:

- Contribution
- Expense share
- Current balance

Example:

Raj
Contributed ₹10,000
Balance +₹3,250

---

# 25. Invite Management

Admin screen:

Invite People

[ Share Link ]

[ Show QR ]

[ Copy Link ]

Invite code:
GOA7XK

Future:
- Regenerate invite
- Disable invite
- Approve new members

---

# 26. Notifications

Not required for MVP.

Potential future notifications:

- Someone joined the trip
- Someone added a contribution
- Someone added an expense
- Someone edited an expense
- Settlement requested
- Settlement marked paid

Avoid excessive notifications.

---

# 27. Receipts

Future feature.

User can attach:
- Camera photo
- Gallery image

Example:

Dinner ₹8,500
[receipt.jpg]

The receipt should be linked to the transaction.

Do not make receipt upload mandatory.

---

# 28. Offline Support

Not required for the first MVP.

Potential future requirement because travel often has weak connectivity.

Possible behavior:
- Create local pending transaction
- Sync when online
- Show sync status

This must be designed carefully to avoid duplicate financial transactions.

---

# 29. Security

The production application must enforce:

A user can only access trips where they are a member.

Trip members can only access transactions belonging to that trip.

Admin actions must be role-protected.

Invite codes should not expose sensitive information.

Do not rely only on frontend permission checks.

Database-level Row Level Security should enforce access.

---

# 30. Recommended Technology

For MVP:

Frontend:
- React Native
- Expo
- TypeScript
- Expo Router

Backend:
- Supabase

Database:
- PostgreSQL

Realtime:
- Supabase Realtime

Data fetching:
- TanStack Query

Forms:
- React Hook Form
- Zod

Styling:
- NativeWind or another consistent styling system

Authentication:
- Start with lightweight invite/member identity
- Add Supabase Auth for production

---

# 31. Suggested Database Model

## users

id
name
email
phone
avatar_url
created_at

## trips

id
name
description
currency
start_date
end_date
created_by
invite_code
status
created_at
updated_at

## trip_members

id
trip_id
user_id
display_name
role
status
joined_at

## transactions

id
trip_id
type
description
amount
currency
paid_by_member_id
category_id
created_by_member_id
payment_source
transaction_date
note
receipt_url
created_at
updated_at

Types:

contribution
pool_expense
member_expense
settlement
refund

## transaction_splits

id
transaction_id
member_id
share_amount
created_at

## settlements

id
trip_id
from_member_id
to_member_id
amount
status
created_at
paid_at
confirmed_at

## categories

id
trip_id
name
created_at

---

# 32. Important Accounting Rules

Rule 1:
Contribution increases pool.

Rule 2:
Pool expense decreases pool.

Rule 3:
Member-paid group expense does not automatically decrease pool.

Rule 4:
A member-paid expense increases the payer's credit.

Rule 5:
Every group expense must have participants.

Rule 6:
Participant shares must equal the total expense.

Rule 7:
Personal expenses must not affect group balances.

Rule 8:
Settlements are transfers, not expenses.

Rule 9:
One trip's transactions never affect another trip.

Rule 10:
All financial calculations must be deterministic.

---

# 33. Example Complete Trip

17 members.

Everyone contributes ₹5,000.

Total contribution:

17 × ₹5,000 = ₹85,000

Pool:

₹85,000

Hotel:

₹35,000

Food:

₹12,000

Cabs:

₹5,000

Activities:

₹8,000

Total pool expenses:

₹60,000

Remaining pool:

₹25,000

The app then calculates each person's actual expense share based on participation.

If everyone participated equally:

₹60,000 / 17 = ₹3,529.41 approximately per person.

But if only 10 people joined a ₹10,000 activity, only those 10 receive a share of that activity.

Final balances must use the actual individual shares.

---

# 34. Common Use Cases

## Use Case A: Equal group trip

17 people share all expenses equally.

## Use Case B: Different activities

10 people go scuba diving.
7 people do not.

Only 10 people split scuba.

## Use Case C: One person pays

Raj pays ₹20,000 for hotel personally.

All 17 benefit.

Raj receives credit for the other 16 shares.

## Use Case D: Common pool

Everyone contributes ₹5,000.

Hotel is paid directly from the common pool.

Pool decreases.

## Use Case E: Mixed payment model

Everyone contributes to the pool.

Raj additionally pays for dinner personally.

Both pool and member-paid transactions coexist.

## Use Case F: Someone joins late

A new member joins after the hotel was booked.

They should not automatically become responsible for historical expenses unless explicitly added to those expenses.

## Use Case G: Someone leaves

A member can be marked inactive.

Historical transactions remain unchanged.

## Use Case H: Refund

Hotel refunds ₹5,000 to the pool.

Record a refund transaction.

Do not delete the original hotel expense.

---

# 35. MVP Scope

Build these first:

### Must Have

- Create multiple trips
- Trip list
- Create trip
- Invite link
- Join trip
- 17+ members
- Dashboard
- Pool balance
- Contributions
- Pool expenses
- Member-paid expenses
- Expense participants
- Equal split
- Custom split
- Transaction history
- Transaction details
- Members
- Individual balances
- Settlement calculation
- Realtime updates

### Should Have

- Edit transaction
- Delete transaction
- Categories
- QR invite
- Balance explanation

### Later

- Google/Apple authentication
- Phone OTP
- Receipt upload
- Push notifications
- Settlement confirmation
- UPI payment links
- Offline mode
- CSV/PDF export
- Expense analytics
- Recurring expenses
- Multiple currencies
- Web dashboard
- AI receipt extraction
- Subscription/monetization

---

# 36. MVP User Journey

### New user

Open app
→ Create Trip
→ Enter trip details
→ Trip dashboard
→ Share invite
→ Friends join
→ Add contributions
→ Add expenses
→ Everyone sees realtime ledger
→ View balances
→ Finish trip
→ Generate settlement
→ Members settle
→ Close/archive trip

### Returning user

Open app
→ My Trips
→ Select trip
→ Dashboard
→ Add/view transactions

---

# 37. UX Priorities

The application should feel:

- Fast
- Minimal
- Trustworthy
- Financially clear
- Mobile-first
- Easy for non-technical users

Avoid:
- Complex accounting terminology
- Large forms
- Too many settings
- Unnecessary charts
- Excessive onboarding

The user should be able to add a normal expense in under 20 seconds.

---

# 38. Product Differentiator

The product is not simply another Splitwise clone.

Positioning:

**Trip Wallet = transparent shared group wallet + expense ledger + settlement.**

Core mental model:

Money In
→ Common Pool
→ Money Out
→ Individual Shares
→ Final Settlement

The dashboard should make this model visually obvious.

---

# 39. Future Product Expansion

The same infrastructure can support:

- Travel groups
- Weddings
- Bachelor/bachelorette parties
- Family funds
- College groups
- Office outings
- Roommates
- Sports teams
- Event committees
- Group gifts
- Temporary project budgets

The product should therefore use the generic concept of a **Trip/Group**, not hard-code Goa or travel.

---

# 40. Development Strategy

Build in this order:

1. Database schema
2. Trip creation
3. Multiple-trip home
4. Invite/join
5. Members
6. Contribution
7. Pool expense
8. Member-paid expense
9. Transaction history
10. Balance calculation
11. Settlement algorithm
12. Realtime synchronization
13. Edit/correction flow
14. Security/RLS
15. UX polish

Do not build monetization or advanced features before the core ledger is correct.

---

# 41. Claude Development Instructions

When using this document as a reference, treat it as the product source of truth.

Before implementing a feature:
1. Check whether it exists in this specification.
2. Preserve the accounting rules.
3. Do not simplify away the distinction between contribution, pool expense, member-paid expense, and settlement.
4. Do not introduce assumptions about how money was paid.
5. Ask for clarification when financial behavior is ambiguous.
6. Keep financial calculations separate from UI components.
7. Write unit tests for all balance and settlement calculations.
8. Prefer integer paise for monetary calculations.
9. Enforce authorization at the backend/database level.
10. Keep the application generic for multiple trips, not Goa-specific.

---

# 42. Definition of Done for MVP

The MVP is ready when:

- A user can create multiple trips.
- A second person can join using a link.
- 17 or more members can join one trip.
- Members can see the same transactions.
- Contributions update the pool.
- Pool expenses reduce the pool.
- Member-paid expenses correctly credit the payer.
- Different participant sets can be used for different expenses.
- Equal and custom splits work.
- Individual balances are correct.
- Settlement transfers balance exactly.
- Realtime updates work.
- A transaction can be traced from dashboard to its individual splits.
- Unauthorized users cannot access another trip's ledger.
- Financial calculations have automated tests.
- Refreshing/reopening the app does not lose transactions.

---

# 43. Product Name

Working name:

**Trip Wallet**

Possible future branding:
- TripPool
- GroupWallet
- PoolTrip
- TripLedger
- SplitPool
- GoTogether
- CrewWallet

Do not lock branding during MVP development.

---

# 44. One-Sentence Product Definition

**Trip Wallet is a realtime shared wallet and transparent expense ledger that lets groups collect money, record expenses, track individual shares, and settle the final balance with minimal transfers.**
