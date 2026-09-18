# Potto Invitation & Join Request Feature Specification

## Purpose

Implement the complete Potto invitation and member join flow.

**Core rule:** Every Pot has exactly one reusable invitation link. The link identifies the Pot, not a person, and does not itself grant access.

## 1. Domain Model

### Potto User

Global account:

```text
users
- id
- name
- email
- phone
- avatar
- created_at
```

One user can belong to multiple Pots.

### Pot

A shared wallet/group:

```text
pots
- id
- name
- description
- created_by
- invite_code
- invite_enabled
- created_at
```

Each Pot has exactly one active invitation link.

### Pot Member

A person's financial identity inside one Pot:

```text
pot_members
- id
- pot_id
- user_id nullable
- display_name
- role
- access_level
- status
- created_at
```

`user_id` is nullable because a member can exist before they have a Potto account.

**Financial transactions must reference `pot_member_id`, not `user_id`.**

This is critical. Linking an account to an existing member must never create a second financial identity or move historical transactions.

### Join Request

A Potto user requesting access to a Pot:

```text
join_requests
- id
- pot_id
- user_id
- requested_name
- status
- linked_member_id nullable
- reviewed_by nullable
- reviewed_at nullable
- created_at
```

Suggested statuses:

```text
pending
approved
rejected
cancelled
```

---

## 2. Invitation Link

Each Pot has exactly one invitation link.

Example:

```text
potto.app/invite/goa-7k2m
potto.app/invite/mussoorie-x91p
potto.app/invite/nainital-4fz8
```

The actual invite code must be unique, random/non-sequential, and hard to guess.

Do not use the Pot name alone as the database identity.

The same link is shared with everyone joining the Pot.

The invite URL must identify only the Pot. Do not encode user ID, member ID, role, permissions, or financial data in it.

The invite link is only an entry point to a join request. It is **not authorization**.

Support `invite_enabled` so the link can later be disabled/revoked.

---

## 3. Existing Members Before Joining

An Admin can create members before those people have Potto accounts.

Example:

```text
Goa 2026

Raj          ADMIN
Rajkumar     MEMBER
Sakshi       MEMBER
Mona         MEMBER
Sunil        MEMBER
```

Rajkumar may already have contributions, expenses, settlements and a balance.

Raj shares the same Pot invite link with everyone.

When Rajkumar opens it and authenticates, Potto must **not automatically assume** that he is the existing `Rajkumar` member.

Instead:

1. Resolve invite code to Pot.
2. Authenticate the user.
3. Ask for/display the requester's name.
4. Create a `join_request`.
5. Admin reviews it.
6. Admin explicitly links it to an existing member OR creates a new member.

When linked to an existing member:

```text
pot_member.user_id = requesting_user.id
```

The existing `pot_member.id` remains unchanged.

All historical transactions continue referencing the same `pot_member_id`.

---

## 4. Name Matching

Name matching may be shown only as a suggestion.

Example:

```text
Requester:
Rajkumar Jangid

Possible match:
Rajkumar
```

Never automatically link based on name, email, phone, or fuzzy matching.

Admin must explicitly choose:

- Link to existing member
- Create new member
- Reject

If uncertain, never force a match.

---

## 5. Join Flow

### Invite Page

Opening:

```text
potto.app/invite/{invite_code}
```

resolves the Pot and shows a safe summary:

```text
Goa 2026

Raj invited you to join this Pot.

6 members
₹26,000 contributed
₹18,600 spent

[Request to Join]
```

Do not expose unnecessary private information.

If unauthenticated, authenticate before creating the request.

### Identity

After authentication:

```text
How should we identify you?

Rajkumar Jangid

The Pot admin will review your request before giving access.

[Send Join Request]
```

Store the submitted name as `requested_name`.

Do not create a Pot member yet.

### Request Sent

```text
Request sent

Your request to join Goa 2026 is waiting for admin approval.

We'll let you know when it is approved.
```

No Pot access before approval.

---

## 6. Duplicate Handling

If already an active member:

```text
You're already a member

You already have access to Goa 2026.
```

If a pending request exists:

```text
Request already sent

Your join request is waiting for admin approval.
```

Do not create duplicate pending requests for the same user + Pot.

Use appropriate PostgreSQL constraints/partial unique indexes.

---

## 7. Admin Members Screen

Recommended:

```text
Members +

6 members

ACTIVE

Raj
ADMIN

Rajkumar
MEMBER

Sunil K
MEMBER

Sunil S
MEMBER

Sakshi
MEMBER

Mona
VIEW ONLY

PENDING

1 Join Request

Rajkumar Jangid
[Review]
```

Join Requests must be clearly accessible to Admins.

---

## 8. Review Request

Example:

```text
Join Request

Rajkumar Jangid

Wants to join:
Goa 2026

Existing members

( ) Raj
( ) Rajkumar
( ) Sakshi
( ) Mona
( ) Sunil

[Link to existing member]

or

[+ Create New Member]

Access

( ) Member
( ) View Only

[Reject Request]
[Approve & Link]
```

Admin must explicitly select how the requester should be represented.

---

## 9. Existing Member Linking

Before linking an existing member, show:

```text
Link account to existing member?

Rajkumar Jangid → Rajkumar

Existing history:
- Contributions
- Expenses
- Settlements
- Current balance

This account will inherit this Pot member's existing history and balance.

[Cancel]
[Confirm & Approve]
```

Approval/linking must be atomic.

Conceptually:

```text
join_request.status = approved
join_request.linked_member_id = selected_member.id
selected_member.user_id = requester.user_id
```

Do not create another financial member.

---

## 10. New Member Approval

If the requester is not an existing member:

```text
Create new member

Display name:
Rajkumar Jangid

Access:
Member / View Only

[Create & Approve]
```

Create a new `pot_member` and link the requester to it.

Never merge or reassign another member's historical financial transactions.

---

## 11. Rejection

Admin can reject:

```text
Reject join request?

Rajkumar Jangid will not get access to Goa 2026.

[Cancel]
[Reject]
```

Rejected users may request again through the same invite link unless product rules later say otherwise.

---

## 12. Removed Members / Rejoin

Removing a member must not delete the financial identity.

Prefer:

```text
pot_member.status = inactive
```

Historical transactions remain attached to that member.

If the person later joins again:

1. They submit a new join request.
2. Admin reviews it.
3. Admin can link them back to the old inactive `pot_member`.
4. Historical records and balance remain intact.

---

## 13. Roles and Access

### Admin

Can:
- View everything
- Add money
- Add expenses
- Edit/delete transactions
- Settle
- Manage members
- Review join requests
- Invite people
- Edit Pot settings

### Member

Can:
- View everything
- Add money
- Add expenses
- View balances
- Record settlements
- Invite people
- Edit their own entries where supported

Cannot:
- Manage members
- Review join requests
- Delete other members' transactions

### View Only

Can:
- View Pot
- View Activity
- View Members
- View Balances

Cannot:
- Add money
- Add expense
- Settle
- Edit/delete
- Manage members
- Review join requests

**Permissions must be enforced server-side, not only hidden in the UI.**

---

## 14. Multiple Pots

A user can belong to multiple Pots.

Each Pot has completely isolated:

- invite code
- members
- join requests
- transactions
- balances

Every join request must contain the specific `pot_id`.

An invite code must resolve to exactly one Pot.

No data may leak across Pots.

---

## 15. Invite Screen

Inside a Pot:

```text
Invite people to Goa 2026

Share this link with everyone joining this Pot.

potto.app/invite/goa-7k2m

[Copy Link]
[Share Link]
[Show QR Code]
```

Do not generate a different link per member.

---

## 16. Navigation / Production UI

Recommended Pot navigation:

```text
Dashboard
Activity
Members
Settle Up
Invite
Pot Settings
```

Use a normal top-right `⋮` menu for:

```text
Pot Settings
Manage Members
Join Requests
Invite Members
Edit Pot
Archive Pot
```

The current large blue gear/debug button in the prototype must not be part of production UI.

---

## 17. Security

The invitation link is not authorization.

Server-side checks must verify:

- invite code exists
- invite is enabled
- Pot exists
- requester is authenticated where required
- join request belongs to the resolved Pot
- only authorized Admins can approve/reject
- access levels are enforced
- Pot data is isolated

Future hardening may include:

- rate limiting
- invite regeneration
- expiration
- abuse prevention
- audit logs

Do not expose sensitive information on a public invite page.

---

## 18. Database Constraints

Consider:

```text
pots.invite_code UNIQUE

pot_members:
UNIQUE(pot_id, user_id)
where user_id IS NOT NULL

join_requests:
prevent duplicate active/pending request for the same user + pot
```

Foreign keys:

```text
join_requests.pot_id -> pots.id
join_requests.user_id -> users.id
join_requests.linked_member_id -> pot_members.id
pot_members.pot_id -> pots.id
```

Use PostgreSQL partial unique indexes where appropriate.

---

## 19. Important Accounting Integrity Rules

This feature must never corrupt Potto accounting.

Never:

- reassign transactions because names look similar
- automatically merge members
- move transactions to another user
- recalculate historical transactions based on current membership
- delete a financial identity when access is removed

Transactions remain attached to:

```text
pot_member_id
```

Joining only attaches a Potto account to an existing financial identity.

---

## 20. Edge Cases

Handle at least:

1. Invalid invite code
2. Disabled/revoked invite
3. Archived/deleted Pot
4. Unauthenticated invite visitor
5. Authentication cancelled
6. User already active
7. User already has pending request
8. Previously rejected user requests again
9. Existing inactive member
10. Admin links existing member
11. Admin creates new member
12. Admin rejects request
13. Two admins review simultaneously
14. Same account joins from multiple devices
15. User belongs to multiple Pots
16. Similar Pot names
17. Invite-code collision
18. Selected member already linked to another user
19. Selected member has historical transactions
20. Selected member has non-zero balance
21. Removed member rejoins
22. Network failure during approval
23. Realtime update during review
24. Server permission denial
25. Invite opened after revocation

Approval/linking must be atomic so a Pot member cannot accidentally become linked to two users.

---

## 21. Implementation Order

Before modifying code:

1. Inspect the current repository.
2. Inspect existing Potto product/spec Markdown files.
3. Inspect database schema, migrations, types and APIs.
4. Inspect existing Pot, member, transaction and navigation code.
5. Reuse existing architecture/components.
6. Do not rebuild unrelated features.

Recommended order:

```text
Database/schema
        ↓
Server authorization / RPC / API
        ↓
Invite resolution
        ↓
Join request creation
        ↓
Admin request management
        ↓
Existing-member linking
        ↓
New-member creation
        ↓
Access control
        ↓
Invite UI
        ↓
Join UI
        ↓
Admin review UI
        ↓
Realtime/state updates
        ↓
Tests
```

Prefer transactional server-side operations for approval/linking.

The client must never be trusted to enforce permissions or identity ownership.

---

## 22. Acceptance Criteria

- [ ] Every Pot has exactly one unique invite link.
- [ ] Same link can be shared with multiple people.
- [ ] Invite resolves to the correct Pot.
- [ ] Invite does not directly grant access.
- [ ] Authentication works correctly.
- [ ] Join request is created for the correct Pot/user.
- [ ] Duplicate pending requests are prevented.
- [ ] Existing active members get the already-member state.
- [ ] Admin can view pending requests.
- [ ] Admin can link to an existing Pot member.
- [ ] Admin can create a new Pot member.
- [ ] Admin can reject a request.
- [ ] Access level is selected during approval.
- [ ] Existing member history remains untouched.
- [ ] Transactions remain attached to the same `pot_member_id`.
- [ ] Removed members retain financial history.
- [ ] Removed members can later be re-linked.
- [ ] Permissions are server-side enforced.
- [ ] Pots remain fully isolated.
- [ ] Invalid/disabled invites are handled safely.
- [ ] Concurrent approval cannot create duplicate links.
- [ ] Loading, empty, success and error states exist.
- [ ] Copy/share/QR actions work.
- [ ] Debug gear/button is removed from production UI.

## 23. End-to-End Definition of Done

The complete flow should work as:

```text
Create Pot
  ↓
Potto creates one invite link
  ↓
Share the same link with everyone
  ↓
Person opens link
  ↓
Person authenticates
  ↓
Person sends join request
  ↓
Admin receives request
  ↓
Admin links existing member OR creates new member
  ↓
Admin selects access level
  ↓
Approval completes atomically
  ↓
User gets Pot access
  ↓
Existing financial history remains intact
```

No duplicate financial identity should be created accidentally, and no historical transaction should be reassigned merely because someone joins the Pot.
