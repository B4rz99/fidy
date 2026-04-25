# Fidy

Fidy keeps the user's financial source of truth on device while allowing explicit cloud AI processing for ingestion and advisor tasks. This context captures the privacy and recovery boundaries for replacing plaintext remote financial sync with encrypted backup.

## Language

**Capture Interpreter**:
The AI-assisted ingestion boundary that turns capture evidence into a structured transaction, transfer, or review candidate.
_Avoid_: Regex parser, email parser

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

## Relationships

- The **Local Ledger** is the source of truth for transactions, transfers, financial accounts, budgets, goals, capture evidence, and financial derivations
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
- Deterministic ledger validation owns the final save decision after a **Capture Interpreter** produces a candidate
- A **Financial Context Packet** is narrower than the **Local Ledger** and should be built per advisor request
- AI advisor features should use **Financial Context Packets** instead of server-side queries over plaintext financial tables
- Weekly digest-style insights should be generated from the **Local Ledger** on device unless the user explicitly opts into **Cloud AI Processing**

## Example dialogue

> **Dev:** "If we stop syncing readable transactions to Supabase, how does the user recover after deleting the app?"
> **Domain expert:** "The device creates an **Encrypted Backup** of the **Local Ledger**; Supabase stores only ciphertext, and restore requires the user's **Recovery Key** or platform-held key material."

## Flagged ambiguities

- "local-first" was used to mean both on-device source of truth and server-side plaintext recovery. Resolved: use **Local Ledger** for the source of truth and **Encrypted Backup** for recovery.
- "sync" was used to mean both recovery and cross-device plaintext replication. Resolved: use **Encrypted Backup** for recovery and **Remote Financial Sync** for the legacy plaintext replication model.
- "AI-first" could imply either cloud-only AI or private on-device-only AI. Resolved: MVP permits explicit **Cloud AI Processing** while avoiding stored plaintext financial rows on Fidy servers.
