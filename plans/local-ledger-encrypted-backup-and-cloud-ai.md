# Local Ledger, Encrypted Backup, and Cloud AI Migration

## Problem

Fidy was intended to feel local-first and on-device, but the current sync architecture stores readable financial rows in Supabase so users can recover data after deleting the app. That solves durability, but it turns Supabase into a plaintext financial ledger and lets server-side features query financial rows directly.

The MVP still needs AI-first ingestion and an AI financial advisor. Regex-only parsing is too fragile for Colombian bank emails, notifications, Apple Pay, and Google Pay evidence, and on-device foundation models are not yet a dependable baseline across all MVP devices.

## Target

- The device-owned SQLite database is the **Local Ledger**.
- Supabase no longer stores plaintext financial records for recovery.
- Supabase stores auth, operational non-financial data, and encrypted backup blobs plus metadata.
- AI ingestion and advisor features use explicit **Cloud AI Processing** boundaries.
- Cloud AI inputs are task-scoped and not stored as Fidy financial records.
- Server-side features do not query plaintext `transactions`, `budgets`, `goals`, `financial_accounts`, `transfers`, `opening_balances`, identifiers, or capture evidence.

## Current Plaintext Server Surfaces

- `apps/mobile/features/sync/services/syncEngine.ts` pushes financial rows to Supabase tables.
- `supabase/functions/weekly-digest/index.ts` reads transactions, budgets, and goal contributions server-side.
- `supabase/functions/ai-chat/index.ts` builds advisor context by querying plaintext financial rows server-side.
- Capture parsing already sends sanitized text to cloud AI, but the result is later persisted through normal financial sync.

## Architecture

### Local Ledger

SQLite owns all financial records and derivations:

- transactions
- transfers
- financial accounts
- opening balances
- budgets
- goals and contributions
- capture evidence
- account identifiers and suggestion dismissals
- review queues and conflict/retry state

### Encrypted Backup

The app exports a canonical backup snapshot, encrypts it on device, and uploads only ciphertext plus non-financial metadata:

- backup id
- user id
- created at
- schema version
- app version
- device label
- ciphertext size
- hash/checksum

The backup payload should be versioned so restore can run migrations before opening the Local Ledger.

### Recovery Key

The manual recovery fallback is a generated **Recovery Key**, but the user-facing experience should be **Private Backup**, not "manage an encryption key." The default flow should feel like turning on a protected app backup, with platform-native storage handling same-device recovery where possible and the Recovery Key kept by the user for lost-phone or new-device restore.

UX target:

- Non-technical mobile users should understand the promise in one sentence: Fidy can save an encrypted backup, but only they can unlock it.
- Google, Microsoft, or Apple login should locate the user's backup account, not decrypt the backup by itself.
- Same-device restore should be nearly invisible when platform secure storage still has the key.
- New-device or lost-device restore should use the user's Recovery Key or a platform-backed recovery mechanism.
- Losing the Recovery Key must be treated as a clear product state, not hidden in fine print.

Security target:

- Fidy must never store plaintext financial records remotely.
- Fidy must never store a raw backup encryption key remotely.
- Fidy must never store an unwrap-capable server secret that can decrypt a user's backup without the user's Recovery Key or platform-held key material.
- Recovery key wrapping must happen on device.
- Every remote backup should be encrypted with a random backup data key and authenticated encryption.
- The backup data key may have multiple wrapped copies, but every wrap must require the user's Recovery Key or platform-held key material.
- If the Recovery Key and all platform-held key material are gone, the old Local Ledger is unrecoverable.

Platform constraints:

- `expo-secure-store` can store key material in iOS Keychain and Android secure storage, but it must not be the only source of truth for irreplaceable recovery.
- On iOS, SecureStore-backed Keychain data may survive reinstall with the same bundle ID, but the app should not depend on that behavior as the sole recovery path.
- On Android, SecureStore data does not survive uninstall because Android Keystore entries are removed; restored SecureStore shared preferences cannot be decrypted.
- iOS Keychain access does not require Sign in with Apple. Sign in with Apple is an auth and App Store review concern, not a prerequisite for storing backup key material on iOS.

Recommended recovery ladder:

1. **Device unlock**: use stored local key material for normal app use and same-device reinstall when available.
2. **Private Backup restore**: after login, locate the encrypted backup and try platform-backed recovery.
3. **Manual recovery**: ask for the Recovery Key only when platform recovery cannot unlock the backup.
4. **No-secret state**: if the user cannot unlock the backup, let them start fresh without implying Fidy can recover the old ledger.

Lost-phone UX:

- Treat "I lost my phone" as a primary restore path on the sign-in/restoration screen.
- First ask the user to sign in with Google, Microsoft, or Apple so Fidy can find backup metadata.
- If platform-backed key recovery is available, unlock the backup without asking the user to understand encryption.
- If platform recovery is not available, ask for the Recovery Key with calm copy and clear examples of where they may have saved it.
- If the user cannot provide the Recovery Key, explain that the backup is still private but cannot be unlocked, then offer "Start fresh" as the next step.
- Do not frame this as an account problem: login identifies the backup; the Recovery Key or platform-held key material unlocks it.
- In settings, show a backup health check that warns users before a lost-phone event if they have not confirmed their Recovery Key.

Strict security stance:

- Do not add Fidy-managed escrow for MVP.
- Do not add "forgot Recovery Key" reset for encrypted backups.
- Do not auto-restore from login alone.
- Do not send the Recovery Key to Supabase or AI providers.
- Do not log Recovery Keys, derived keys, wrapped keys, or backup plaintext.
- Use a generated Recovery Key instead of a user-created password because non-technical users commonly choose weak passwords.
- Require the user to confirm the Recovery Key before considering Private Backup healthy.
- Let users rotate the Recovery Key by decrypting locally, generating a new Recovery Key, rewrapping the backup key, and uploading new wrapped-key metadata.

Recommended auth direction:

- Add Sign in with Apple before iOS launch if Google/Microsoft remain primary sign-in options. It is not needed for Keychain, but it is the expected equivalent privacy-focused login path on iOS and reduces trust friction for users already in the Apple ecosystem.
- Keep Google and Microsoft because they match current email-capture sources, but do not imply that those providers can decrypt Fidy backups.

### Cloud AI Processing

Cloud AI is allowed for explicit tasks:

- interpret one capture into a transaction, transfer, or review candidate
- classify a merchant/category when local rules are insufficient
- answer advisor questions from a task-scoped financial context packet

Cloud AI is not allowed to become remote storage:

- no plaintext financial rows persisted for recovery
- no long-lived server-side advisor profile built from financial records
- no server-side weekly digest over plaintext financial tables

## Implementation Slices

1. Name the boundaries
   - Add domain language and ADR.
   - Add a feature flag or config value for legacy Remote Financial Sync.
   - Add tests that make current plaintext sync surfaces visible.

2. Build backup export/import
   - Create a canonical `BackupSnapshot` schema for the Local Ledger.
   - Export all financial tables from SQLite.
   - Import into a clean local database and run existing migrations.
   - Add round-trip tests for transactions, transfers, accounts, budgets, goals, and capture evidence.

3. Add on-device encryption
   - Generate backup encryption keys on device.
   - Derive or wrap the key with the Recovery Key.
   - Encrypt/decrypt snapshots locally.
   - Add corruption, wrong-secret, and schema-version tests.

4. Add remote backup storage
   - Add Supabase storage/table metadata for encrypted backup blobs.
   - Upload, list, download, and delete backups.
   - Ensure RLS never exposes backups across users.
   - Keep metadata non-financial.

5. Replace recovery sync
   - Stop enqueueing financial rows to Remote Financial Sync for new users.
   - Keep legacy migration support for existing users until their encrypted backup is created.
   - Add a settings surface for backup status and restore.

6. Move insights off server-side financial queries
   - Replace weekly digest Edge Function financial queries with on-device local notification generation.
   - Change AI chat to receive a Financial Context Packet from the app instead of querying Supabase financial tables.

7. Harden cloud AI boundaries
   - Create a Capture Interpreter API that returns structured candidates only.
   - Persist only local ledger results and encrypted backups.
   - Log request metadata without raw financial payloads.
   - Add tests that cloud AI callers do not write plaintext financial records remotely.

8. Retire plaintext financial tables
   - After migration, prevent new writes to plaintext financial tables.
   - Export/delete legacy plaintext financial rows for users who have migrated.
   - Keep deletion/account-closure paths aligned with encrypted backup deletion.

## Open Decisions

- Should Private Backup be automatic after first successful onboarding, or should users explicitly enable it before their first captured data is saved?
- Resolved: manual recovery uses a generated Recovery Key, not a phrase, passphrase, or user-created password.
- Are cloud AI ingestion and advisor enabled by default with disclosure, or opt-in before first use?
- What exact retention promise applies to cloud AI request payloads and provider logs?
