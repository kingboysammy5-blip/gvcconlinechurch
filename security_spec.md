# GVCC Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path defaults to `allow read, write: if false;`.
2. **Verified Email Identity**: Standard writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Owner-Isolated PII**: `/users/{userId}` contains `email` (PII). Reads (`get`) and writes are restricted strictly to `request.auth.uid == userId` or `isAdmin()`, and `list` on `/users` is permanently denied (`false`).
4. **Master Gate Subcollections**: Every read/write on `/users/{userId}/bookmarks/{bookmarkId}` and `/users/{userId}/gameRuns/{runId}` verifies parent `/users/{userId}` exists and `get(...).data.uid == request.auth.uid` (and for `allow list`, enforces `resource.data.uid == request.auth.uid` without `get()`/`exists()` inside `allow list`).
5. **Strict Blueprint Keys & Bounds**: Every create verifies `keys().hasAll(...) && keys().hasOnly(...)`, string `.size()` bounds, integer range checks, bounded lists (`<= 10` elements), and regex ID checks (`^[a-zA-Z0-9_\\-]+$`).
6. **Immutable Ownership & Temporal Integrity**: `uid` and `createdAt` are immutable across updates; `createdAt == request.time` on create; `updatedAt == request.time` on create/update; `affectedKeys().hasOnly(...)` explicitly scopes every update branch.
7. **Non-PII Leaderboard**: `/leaderboard/{userId}` stores only `uid`, `displayName`, `bestScore`, `bestWave`, `totalLambsSaved`, `createdAt`, `updatedAt` (zero email/phone fields), and allows `create`/`update` only by `request.auth.uid == userId` with verified email.
8. **Owner-Isolated Prayer Requests (`/prayer_requests/{requestId}`)**: Contains optional PII (`phone`, `email`) and pastoral privacy controls. `get` and `list` are strictly scoped to the document owner (`resource.data.uid == request.auth.uid`) or `isAdmin()`. Creation mandates `status == 'New'`, `consent == true`, `uid == request.auth.uid`, and server timestamps (`request.time`); updates enforce terminal state locking when `status == 'Archived'`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Identity Spoofing on User Create**: Authenticated user `uidA` creates `/users/uidB` with `{ uid: "uidB", ... }` -> Denied by `isOwner(userId)` + `uid == request.auth.uid`.
2. **Shadow / Ghost Field Injection (Privilege Escalation)**: User `uidA` creates `/users/uidA` including `{ ..., role: "super_admin", isAdmin: true }` -> Denied by `keys().hasOnly(...)`.
3. **Email Spoofing (`email_verified: false`)**: Attacker with `email: "kingboysammy5@gmail.com"` and `email_verified: false` attempts admin read/write -> Denied by `request.auth.token.email_verified == true`.
4. **Cross-User PII Blanket Read (`get`)**: Authenticated user `uidB` attempts `get(/users/uidA)` or `get(/prayer_requests/reqOwnedByA)` -> Denied (`allow get: if isOwner(userId) || isAdmin()`).
5. **User Directory & Prayer Collection Enumeration (`list`)**: Non-admin attempts `list(/users)` or `list(/prayer_requests)` without `where('uid', '==', auth.uid)` -> Denied by rule-side `resource.data.uid == request.auth.uid`.
6. **Orphaned Subcollection Write (Master Gate Bypass)**: User creates `/users/uidA/bookmarks/b1` before `/users/uidA` exists -> Denied by `exists(/databases/$(database)/documents/users/$(userId))`.
7. **Timestamp Forgery on Create**: User creates bookmark or prayer request with client-chosen past timestamp `createdAt: "2020-01-01T00:00:00Z"` -> Denied by `incoming().createdAt == request.time`.
8. **Immutable Field Mutation (`uid` / `createdAt` / `referenceNumber`) on Update**: User updates bookmark or prayer request attempting to mutate immutable fields -> Denied by `affectedKeys().hasOnly(...)` + immutability check.
9. **Path Variable Poisoning**: User attempts write to `/users/uidA/bookmarks/bad$id..1.5kb...` or `/prayer_requests/bad$id` -> Denied by `isValidId()` (`<= 128` chars matching `^[a-zA-Z0-9_\\-]+$`).
10. **Array Exhaustion ("Denial of Wallet")**: User submits bookmark with 50 items in `sourceUrls` or non-string element `[123]` -> Denied by `sourceUrls.size() <= 10` & element type check.
11. **Oversized String Payload**: User submits bookmark with 25,000-character `answer`, or prayer request with `requestContent` > 4,000 chars or invalid `status: 'Answered'` on create -> Denied by `.size()` bounds & status gate.
12. **Score Tampering / Terminal Prayer State Override**: User submits `/leaderboard/uidA` with negative `bestScore: -50`, or non-admin attempts to update an `'Archived'` prayer request -> Denied by numeric bounds & terminal state lock (`existing().status != 'Archived'`).
