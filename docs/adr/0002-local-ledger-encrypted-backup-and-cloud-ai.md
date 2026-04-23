# Local ledger, encrypted recovery, and explicit cloud AI processing

Fidy will stop treating plaintext Supabase financial tables as the durability mechanism for user financial data. The on-device **Local Ledger** remains the source of truth, recovery is provided by remotely stored **Encrypted Backups**, and AI-first ingestion/advisor features may use explicit **Cloud AI Processing** with task-scoped plaintext inputs that are not persisted as Fidy financial records.

**Considered Options**

- Keep plaintext **Remote Financial Sync** in Supabase: simplest for recovery and server-side features, but contradicts the privacy direction for sensitive financial data.
- Require financial data to never leave the device: strongest privacy posture, but conflicts with AI-first ingestion and advisor quality for the MVP.
- Use local ledger plus encrypted backup plus explicit cloud AI processing: preserves AI-first product quality while removing long-lived plaintext financial storage from Fidy-controlled servers.

**Consequences**

Cloud features must receive data through explicit task boundaries, such as capture interpretation or advisor context packets, instead of querying plaintext financial rows from Supabase. Backup restore depends on user-held recovery material; if Fidy cannot decrypt the backup, Fidy also cannot recover it when the user loses the recovery secret.
