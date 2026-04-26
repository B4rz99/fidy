# Local ledger, encrypted recovery, and explicit cloud AI processing

Fidy will stop treating plaintext Supabase financial tables as the durability mechanism for user financial data. The on-device **Local Ledger** remains the source of truth, recovery is provided by remotely stored **Encrypted Backups**, and AI-first ingestion/advisor features may use explicit **Cloud AI Processing** with task-scoped plaintext inputs that are not persisted as Fidy financial records.

**Considered Options**

- Keep plaintext **Remote Financial Sync** in Supabase: simplest for recovery and server-side features, but contradicts the privacy direction for sensitive financial data.
- Require financial data to never leave the device: strongest privacy posture, but conflicts with AI-first ingestion and advisor quality for the MVP.
- Use local ledger plus encrypted backup plus explicit cloud AI processing: preserves AI-first product quality while removing long-lived plaintext financial storage from Fidy-controlled servers.

**Consequences**

Cloud features must receive data through explicit task boundaries, such as capture interpretation or advisor context packets, instead of querying plaintext financial rows from Supabase. Backup restore depends on the user's Recovery Key or platform-held key material; if Fidy cannot decrypt the backup, Fidy also cannot recover it when the user loses that recovery material.

**Legacy Table Retention**

The plaintext Supabase financial tables are retained temporarily for migration and rollback inspection only. Default app sync must not pull from or push to `transactions`, `budgets`, `goals`, `goal_contributions`, `financial_accounts`, `financial_account_identifiers`, `opening_balances`, `transfers`, `capture_evidence`, or `account_suggestion_dismissals`. Any remaining use must opt into `remoteFinancialSync: "legacy"` explicitly and should be removed once migrated users have confirmed healthy Private Backup restore coverage and account deletion has deleted both encrypted backup blobs and any retained legacy rows.
