# Fidy

Fidy keeps the user's financial source of truth on device while allowing explicit cloud AI processing for ingestion and advisor tasks. This context captures the privacy and recovery boundaries for replacing plaintext remote financial sync with encrypted backup.

## Language

**Capture Interpreter**:
The AI-assisted ingestion boundary that turns capture evidence into a structured transaction, transfer, or review candidate.
_Avoid_: Regex parser, email parser

**Capture Evidence**:
Observed source facts from emails, notifications, wallets, or payment surfaces that can support transaction interpretation or account attribution.
_Avoid_: Parsed transaction, raw email data

**Evidence Extractor**:
A deterministic source-specific or generic rule that turns capture text shape into Capture Evidence without storing the source content.
_Avoid_: Regex parser, bank scraper

**Account Identity Evidence**:
Capture Evidence that can identify a specific financial account instance, such as a masked card suffix or account ending.
_Avoid_: Account type hint, card brand

**Account Type Hint**:
Capture Evidence that describes a generic account kind, such as credit card, savings account, or wallet, without naming a product or identifying a specific financial account instance.
_Avoid_: Account identity, account id

**Account Product Hint**:
Capture Evidence that names a specific card or account product without identifying the individual account instance, such as Visa Oro or Mastercard Black.
_Avoid_: Account identity, merchant name

**Counterparty Evidence**:
Capture Evidence that describes the merchant, payee, payer, or other transaction counterparty and must not be used as account attribution evidence.
_Avoid_: Account hint, card product

**Template Shape**:
A non-sensitive structural representation of a capture source template made from canonical field names and redacted value types.
_Avoid_: Email template, raw sample

**Template Diagnostic**:
A non-financial operational signal that records extractor behavior for a Template Shape without storing Plaintext Financial Data.
_Avoid_: Stored email, template archive

**Local Ledger**:
The on-device source of truth for financial records, capture evidence, and financial derivations.
_Avoid_: Local cache, offline copy

**Plaintext Financial Data**:
Readable financial records or capture evidence that reveal a user's financial activity without user-held decryption material.
_Avoid_: Synced data, normal app data

**Encrypted Backup**:
An opaque device-created snapshot of the Local Ledger stored remotely only as ciphertext for recovery after app deletion or device loss.
_Avoid_: Cloud sync, server ledger

**Private Backup**:
The user-facing recovery feature that creates and restores Encrypted Backups without exposing Plaintext Financial Data to Fidy servers.
_Avoid_: Encryption setup, recovery-secret setup

**Recovery Key**:
User-held generated key needed to decrypt an Encrypted Backup after reinstall when platform-held key material is unavailable.
_Avoid_: Recovery phrase, passphrase, password reset, server key

**Cloud AI Processing**:
Explicit, transient processing of selected capture evidence or financial context by a remote AI service.
_Avoid_: Sync, backup, remote storage

**Financial Context Packet**:
A minimal, task-scoped summary built on device from the Local Ledger and sent for Cloud AI Processing.
_Avoid_: Database dump, remote profile

**Remote Financial Sync**:
Plaintext replication of financial records to Fidy-controlled server tables.
_Avoid_: Backup, recovery

**Remote API Boundary**:
The authenticated server-side boundary that owns operational remote reads and writes instead of exposing Fidy-controlled tables or storage directly to the mobile app.
_Avoid_: API extra layer, proxy, backend wrapper

## Relationships

- The **Local Ledger** is the source of truth for transactions, transfers, financial accounts, budgets, goals, capture evidence, and financial derivations
- **Capture Evidence** belongs in the **Local Ledger** unless it is sent transiently for **Cloud AI Processing**
- **Account Identity Evidence** is stronger than an **Account Type Hint** for account suggestions and future account attribution
- **Account Product Hints** are weaker than **Account Identity Evidence** but stronger than generic **Account Type Hints** for onboarding suggestions
- **Counterparty Evidence** may explain who money moved to or from, but it must not create or link financial accounts
- An **Evidence Extractor** may produce **Capture Evidence** from email or notification text only when the matched structure is precise enough to avoid false account attribution
- A **Template Shape** may describe source structure, but it must replace sensitive values such as amounts, names, merchants, dates, account suffixes, authorization numbers, and email addresses with type tokens
- A **Template Diagnostic** may be sent through the **Remote API Boundary** only as operational metadata and must not include raw capture content, parsed financial records, or account suffix values
- **Template Diagnostics** exist to improve **Evidence Extractors**, not to create a remote corpus of user financial activity
- **Remote Financial Sync** is legacy durability infrastructure and should be replaced by **Encrypted Backup**
- **Private Backup** is the user-facing name for **Encrypted Backup** setup and restore
- Fidy-controlled servers must not store **Plaintext Financial Data** as ordinary database rows for recovery
- An **Encrypted Backup** may contain financial records before encryption, but remote storage only receives ciphertext and non-financial backup metadata
- An **Encrypted Backup** exists to restore the **Local Ledger** after app deletion, reinstall, or device loss
- A **Recovery Key** decrypts an **Encrypted Backup** when platform-held key material is unavailable
- Fidy should not be able to decrypt an **Encrypted Backup** without the user's **Recovery Key** or platform-held key material
- The **Recovery Key** is the manual recovery fallback; platform-native storage should make same-device recovery invisible where possible
- Fidy login can locate a user's **Encrypted Backup**, but it must not by itself decrypt the backup
- A lost-phone restore requires either platform-backed recovery or the user's **Recovery Key**
- If the user loses both the device-held secret and the manual recovery fallback, Fidy must not imply that the old **Local Ledger** can be recovered
- Fidy must not offer server-side recovery that lets Fidy decrypt an **Encrypted Backup**
- Strong recovery means accepting that the old **Local Ledger** is unrecoverable when all user-held recovery material is lost
- **Cloud AI Processing** may receive **Plaintext Financial Data** only for explicit ingestion or advisor tasks
- **Cloud AI Processing** must not persist **Plaintext Financial Data** as Fidy financial records
- A **Capture Interpreter** may use **Cloud AI Processing** to interpret fragile capture evidence
- A **Capture Interpreter** must keep account evidence separate from **Counterparty Evidence** so merchants such as Rappi are not suggested as bank accounts or cards
- Deterministic ledger validation owns the final save decision after a **Capture Interpreter** produces a candidate
- Deterministic **Evidence Extractors** should handle high-confidence structural evidence, while the **Capture Interpreter** remains a fallback for fragile or ambiguous capture evidence
- A **Financial Context Packet** is narrower than the **Local Ledger** and should be built per advisor request
- AI advisor features should use **Financial Context Packets** instead of server-side queries over plaintext financial tables
- Weekly digest-style insights should be generated from the **Local Ledger** on device unless the user explicitly opts into **Cloud AI Processing**
- The **Remote API Boundary** owns operational remote access for Encrypted Backups, notification preferences, push device registration, and user memories
- The **Remote API Boundary** does not replace Supabase Auth, and table RLS remains defense-in-depth behind it
- The **Remote API Boundary** is capability-scoped so backup, notification, push-device, and memory operations can be validated, rate-limited, and revoked independently
- **Encrypted Backup** blob transfer uses short-lived signed storage URLs while backup metadata remains owned by the **Remote API Boundary**
- A confirmed **Encrypted Backup** is immutable; creating a newer recovery artifact uses a new backup id instead of overwriting the existing one
- Fidy keeps at most one confirmed **Encrypted Backup** per user; the user-facing **Private Backup** status shows when that backup was last updated
- A newer **Encrypted Backup** replaces the previous one only after local snapshot validation, upload, server-side object integrity verification, and metadata confirmation succeed

## Example dialogue

> **Dev:** "If we stop syncing readable transactions to Supabase, how does the user recover after deleting the app?"
> **Domain expert:** "The device creates an **Encrypted Backup** of the **Local Ledger**; Supabase stores only ciphertext, and restore requires the user's **Recovery Key** or platform-held key material."

> **Dev:** "Can we store a few bank email examples so we can improve account suggestions?"
> **Domain expert:** "No raw examples. Store a **Template Diagnostic** from a redacted **Template Shape** if needed, and keep account suffixes and financial values in the **Local Ledger** only."

> **Dev:** "The AI returned `rappi colombia` in an account hint. Should onboarding suggest a Davibank Rappi account?"
> **Domain expert:** "No. Rappi is **Counterparty Evidence** in that scenario. Only **Account Identity Evidence**, **Account Product Hints**, or explicit **Account Type Hints** can drive account suggestions."

## Flagged ambiguities

- "local-first" was used to mean both on-device source of truth and server-side plaintext recovery. Resolved: use **Local Ledger** for the source of truth and **Encrypted Backup** for recovery.
- "sync" was used to mean both recovery and cross-device plaintext replication. Resolved: use **Encrypted Backup** for recovery and **Remote Financial Sync** for the legacy plaintext replication model.
- "AI-first" could imply either cloud-only AI or private on-device-only AI. Resolved: MVP permits explicit **Cloud AI Processing** while avoiding stored plaintext financial rows on Fidy servers.
- "API extra layer" could imply either a generic proxy or a domain boundary. Resolved: use **Remote API Boundary** for authenticated server-side ownership of operational remote reads and writes.
- "template" could mean a raw bank email sample or a safe structural shape. Resolved: use **Template Shape** for redacted structure and avoid storing raw capture content.
- "account hint" was used for both specific card endings and generic product labels. Resolved: use **Account Identity Evidence** for specific account-identifying signals and **Account Type Hint** for product/kind labels.
- "account hint" also absorbed merchants and payees returned by AI. Resolved: use **Counterparty Evidence** for merchant, payee, and payer facts, and keep it out of account attribution.
