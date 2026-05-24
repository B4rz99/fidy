# Remote API Boundary for Encrypted Backups

## Goal

Harden Supabase access by moving **Encrypted Backup** remote operations behind the **Remote API Boundary** before launch.

The first slice covers only encrypted backup metadata and blob access. Other operational capabilities, including notification preferences and push device registration, come later after the backup boundary is proven.

## Current State

- The **Local Ledger** remains on device.
- Supabase stores encrypted backup blobs plus non-financial metadata.
- The mobile app currently calls Supabase Storage and `encrypted_backups` directly with the authenticated anon client.
- RLS protects user ownership, but the app still has direct PostgREST and Storage access to the backup surface.

## Target State

- Mobile keeps Supabase Auth client-side.
- Mobile calls an authenticated Edge Function for backup operations.
- The Edge Function owns metadata reads and writes using server-side validation.
- Backup blob upload and download use short-lived signed Storage URLs.
- Backup hardening uses two validation layers: local snapshot validity before encryption/upload, and remote object integrity before metadata confirmation.
- Upload confirmation verifies the stored object server-side before metadata is persisted.
- Confirmed backups are immutable; newer backups use new backup ids instead of overwriting existing artifacts.
- Fidy keeps at most one confirmed backup per user and shows the user when it was last updated.
- A new backup deletes the previous confirmed backup only after the new backup is verified and metadata is persisted.
- If upload, verification, or confirmation fails, the previous confirmed backup remains current.
- Direct authenticated table and Storage access is revoked for the encrypted backup capability.
- RLS remains enabled and forced as defense-in-depth.

## Non-goals

- Do not change backup encryption.
- Do not add plaintext remote financial storage.
- Do not proxy full backup blobs through Edge Functions.
- Do not harden notification preferences or push devices in this slice.

## Implementation Slices

### Slice 1: Backup API contract

Define the Edge Function request/response contract:

- get the current backup metadata, returning zero or one confirmed backup
- prepare upload with validated metadata and signed upload URL
- confirm uploaded backup metadata after server-side object verification
- prepare download with signed download URL
- delete backup metadata and object

Exit criteria:

- The contract never accepts or returns backup plaintext, Recovery Keys, trusted device secrets, or unwrap-capable key material.
- The contract validates `backupId`, user ownership, schema version, app version, device label, ciphertext size, and SHA-256 metadata.
- The contract exposes zero or one current backup; it does not expose backup history in this slice.
- The confirm step treats client-provided `ciphertextSha256` as an expected hash, not proof; the Edge Function must read the stored object, compute SHA-256 server-side, and compare it before persisting metadata.
- `prepareUpload` rejects an already-confirmed `(userId, backupId)`.
- `confirmUpload` is retry-safe: if the same `(userId, backupId)` is already confirmed with matching metadata, it returns success or an explicit idempotent success status instead of failing the backup.

### Slice 1A: Local snapshot validation

Add a pure `validateBackupSnapshot(snapshot)` boundary before encryption/upload:

- require supported backup schema version
- decode every table payload through the owning schema
- validate branded IDs at the boundary
- reject duplicate primary IDs inside each entity collection
- reject unresolved references inside the snapshot
- enforce current Local Ledger invariants

Exit criteria:

- Mobile does not encrypt or upload a snapshot that fails validation.
- Unit tests cover malformed rows, duplicate IDs, unresolved references, unsupported versions, and invariant failures.

### Slice 2: Edge Function implementation

Create a single capability-scoped backup Edge Function with explicit action routing, for example `private-backup-api`:

- authenticate the bearer token
- derive `userId` from Supabase Auth, not request body trust
- rate-limit backup operations where appropriate
- create signed upload/download URLs under `encrypted-backups/{userId}/{backupId}.json`
- own metadata insert/list/load/delete through the service role
- verify uploaded object size and SHA-256 before writing metadata

Supported actions:

- `current`
- `prepareUpload`
- `confirmUpload`
- `prepareDownload`
- `deleteCurrent`

Exit criteria:

- Storage paths are server-derived from authenticated user id and backup id.
- Metadata writes happen only after server-side validation.
- Metadata is not persisted when the uploaded object is missing, empty, too large, or hash-mismatched.
- Once metadata is confirmed, the same backup id cannot be overwritten; a replacement backup must use a new backup id.
- After new metadata is confirmed, older confirmed backup metadata and blobs are deleted best-effort.
- Delete removes the current metadata and blob consistently enough for account deletion and user cleanup expectations.
- `confirmUpload` automatically deletes the previous confirmed backup after the new backup is verified and metadata is persisted.
- `deleteCurrent` exists for explicit user actions such as turning off Private Backup or account cleanup flows.
- Failed replacement attempts never delete or hide the previous confirmed backup.

### Slice 3: Mobile backup remote service

Replace direct Supabase table/storage calls in the backup remote-storage module:

- call the backup Edge Function for metadata and signed URLs
- upload/download blobs with the signed URLs
- validate the Local Ledger snapshot before encryption/upload
- keep local ciphertext hash verification after download
- keep existing secret-safety assertions around remote payloads

Exit criteria:

- Mobile code no longer calls `.from("encrypted_backups")` or `.storage.from("encrypted-backups")` for normal backup operations.
- Mobile does not attempt upload when the local snapshot fails validation.
- Existing backup tests prove remote payloads exclude plaintext and secrets.

### Slice 4: Supabase hardening migration

Revoke direct authenticated access for the encrypted backup surface:

- remove authenticated RLS policies on `public.encrypted_backups`
- remove authenticated Storage policies on `storage.objects` for `encrypted-backups`
- keep RLS enabled and forced
- grant only the required service-role access path through the Edge Function

Exit criteria:

- Authenticated mobile sessions cannot directly read/write backup metadata or objects.
- The Edge Function remains able to perform backup operations.

### Slice 5: Regression tests

Add focused tests for the boundary:

- mobile source tests preventing direct encrypted backup table/storage access from returning
- Edge Function tests for auth, ownership, path derivation, invalid metadata, and signed URL creation
- migration/source tests proving direct authenticated backup policies were revoked

Exit criteria:

- Tests fail if the mobile app reintroduces direct backup table/storage access.
- Tests fail if migration policy grants direct authenticated backup access again.

## Later Slices

After Encrypted Backup is hardened, repeat the **Remote API Boundary** pattern for:

- notification preferences
- push device registration and deletion

Each later capability should get its own Edge Function or clearly scoped function surface, validation contract, rate-limit policy, and revocation migration.
