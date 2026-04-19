# Fidy

Fidy tracks personal finance activity captured from manual entry and automatic ingestion sources. This context exists to keep product and code terminology aligned as multi-account behavior is introduced.

## Language

**Transaction**:
A recorded money movement, expense or income, that belongs to one financial account.
_Avoid_: Movement, operation

**Transfer**:
A value movement that settles debt or moves money between accounts without creating new spending or income.
_Avoid_: Expense, income, category

**External Funding Side**:
The non-tracked side of a transfer when the money comes from or goes to something outside the user's tracked financial accounts, such as cash or someone else's funds.
_Avoid_: Dummy account, fake account

**Card Statement Obligation**:
The amount due for a credit-card cycle that is settled by transfer rather than recorded as new spending.
_Avoid_: Bill, expense, payment transaction

**Partial Settlement**:
The state where a card statement obligation has been reduced by one or more transfers but is not yet fully cleared.
_Avoid_: Partial expense, split purchase

**Card Billing Profile**:
The user-configured cycle settings for a credit-card financial account, including statement closing day and payment due day.
_Avoid_: Bill, reminder settings

**Billing Profile Gap**:
The missing billing-profile information that prevents cycle-aware credit-card features from working.
_Avoid_: Error, invalid card

**Statement Closing Day**:
The recurring day when a credit-card statement cycle closes.
_Avoid_: Due date, payment date

**Payment Due Day**:
The recurring day by which a credit-card statement should be paid.
_Avoid_: Closing day, transfer date

**Financial Account Kind**:
The type of financial account, such as checking, savings, wallet, cash, or credit card.
_Avoid_: Category, source

**Financial Account**:
A money-holding instrument that owns a transaction, such as a bank account, wallet, or card.
_Avoid_: Account, connected account, email account

**Settlement Financial Account**:
The financial account that actually sends or receives the money for a transaction.
_Avoid_: Source account, app account

**Capture Source**:
An ingestion channel that provides evidence about a transaction, such as Gmail, Outlook, Android notifications, or Apple Pay intents.
_Avoid_: Account, bank account

**Financial Account Identifier Evidence**:
Stable source evidence that can point to a financial account, such as bank sender, last 4 digits, or account alias.
_Avoid_: Merchant, category

**Financial Account Identifier**:
A user-confirmed identifier owned by a financial account and used for attribution matching.
_Avoid_: Merchant rule, source

**Financial Account Identifier Scope**:
The evidence context required to interpret an identifier safely, such as bank sender plus last 4 digits.
_Avoid_: Global ID, raw identifier

**Account Attribution**:
The act of assigning a transaction to the financial account it belongs to.
_Avoid_: Source mapping, account detection

**Account Attribution State**:
The confidence status of a transaction's financial-account assignment, such as confirmed, inferred, or unresolved.
_Avoid_: Review status, sync status

**Financial Meaning**:
The classification of a captured item as a transaction, transfer, or non-trackable capture.
_Avoid_: Account attribution, category

**Financial Meaning Review Queue**:
The dedicated queue of captured records whose financial meaning still needs user confirmation.
_Avoid_: Attribution review queue, main feed

**Attribution Review Queue**:
The dedicated queue of captured records whose financial account assignment still needs user confirmation.
_Avoid_: Main feed, sync queue

**Dismissed Capture**:
A captured item the user marked as not a trackable financial record, while preserving the underlying capture evidence.
_Avoid_: Deleted transaction, resolved attribution

**Fallback Financial Account**:
The default financial account that temporarily owns a transaction when account attribution is unresolved.
_Avoid_: Unknown account, unassigned

**Default Financial Account**:
The user's primary financial account used as the preselected account for manual entry and as the fallback for unresolved attribution.
_Avoid_: Main category, default source

**Financial Account Bootstrap**:
The automatic creation of the user's default financial account at registration or onboarding start, before capture sync begins.
_Avoid_: Manual first account, post-sync setup

**Account Creation Suggestion**:
An optional, user-confirmed prompt to create or link a financial account after sync based on repeated scoped identifier evidence.
_Avoid_: Auto-created account, single-capture guess

**Suggestion Reason**:
The lightweight explanation shown to the user for why Fidy generated an account creation suggestion.
_Avoid_: Black-box guess, debug dump

**Opening Balance**:
The starting amount or debt assigned to a financial account when tracking begins.
_Avoid_: First transaction, imported income

**Opening Balance Effective Date**:
The date from which an opening balance starts affecting a financial account's balance.
_Avoid_: Created at, statement date

**Reclassification**:
The user-driven act of changing a captured record from one financial meaning to another, such as transaction to transfer.
_Avoid_: Retry, reparse

**Superseded Financial Record**:
A financial record that has been replaced by a corrected interpretation and no longer counts in active balances or analytics.
_Avoid_: Duplicate, archived record

## Relationships

- Every **Transaction** belongs to exactly one **Financial Account**
- A **Transaction** belongs to its **Settlement Financial Account**
- A **Transfer** does not create new spending or income
- A **Transfer** may connect two tracked **Financial Accounts** or one tracked **Financial Account** plus one **External Funding Side**
- A **Transfer** is stored as one atomic record with two sides
- A **Transfer** affects account balances but not spending, income, or budget consumption
- Moving value between bank, cash, wallet, and credit-card accounts is a **Transfer**
- A **Transfer** has one amount in v1, with no embedded fee or split-amount structure
- A **Transfer** in v1 represents completed money movement only
- Users may create **Transfers** manually
- A manual **Transfer** may use an explicit **External Funding Side**
- **External Funding Side** is generic in MVP
- Manual transfer entry shows **External Funding Side** only when the user explicitly chooses movement outside tracked accounts
- The default manual **Transfer** flow assumes movement between tracked **Financial Accounts**
- A **Card Statement Obligation** belongs to one credit-card **Financial Account**
- A **Card Statement Obligation** is settled by **Transfer**, not by a new expense **Transaction**
- A **Card Statement Obligation** may be settled by many **Transfers**
- A **Card Statement Obligation** is in **Partial Settlement** until its remaining due reaches zero
- Every **Financial Account** has one **Financial Account Kind**
- A non-credit-card **Financial Account** represents money available
- Every user has exactly one **Default Financial Account**
- **Financial Account Bootstrap** creates the **Default Financial Account** before onboarding capture sync begins
- An **Account Creation Suggestion** may appear after sync to improve attribution without blocking onboarding
- An **Account Creation Suggestion** requires repeated **Financial Account Identifier Evidence** within one **Financial Account Identifier Scope**
- A single capture or bank sender alone is insufficient for an **Account Creation Suggestion**
- The onboarding flow may include a lightweight optional account-accuracy step immediately after sync and before budget setup
- The onboarding account-accuracy step should show one consolidated review screen rather than one suggestion at a time
- The onboarding account-accuracy step should show only **Account Creation Suggestions**
- Unresolved captured records should be resolved later, after the user has experienced the app's value
- Skipping the onboarding account-accuracy step must not discard **Account Creation Suggestions**
- Deferred **Account Creation Suggestions** should remain available later in the product
- Deferred **Account Creation Suggestions** should be surfaced later through a lightweight home/dashboard prompt rather than settings or review queues
- The optional onboarding review and the later home prompt should open the same consolidated **Account Creation Suggestion** review screen
- Creating an account from an **Account Creation Suggestion** should open a prefilled account form rather than an empty one
- Linking an **Account Creation Suggestion** to an existing account should show a short filtered list of likely matching accounts before the full list
- Creating or linking from an **Account Creation Suggestion** should immediately reprocess matching past unresolved records
- Every **Account Creation Suggestion** should show one lightweight **Suggestion Reason** based on its supporting evidence
- Dismissing an **Account Creation Suggestion** should suppress that exact suggestion until new stronger evidence appears later
- The optional post-sync onboarding review should show only the top few highest-confidence **Account Creation Suggestions**
- The onboarding account-accuracy step should show at most 3 **Account Creation Suggestions**
- Lower-priority **Account Creation Suggestions** should be deferred to the later home/dashboard prompt
- If no strong **Account Creation Suggestions** exist after sync, onboarding should skip the account-accuracy step entirely
- If strong **Account Creation Suggestions** exist after sync, onboarding should automatically continue into the account-accuracy review
- The onboarding account-accuracy step should be framed as an optional improvement rather than required setup
- A credit-card **Financial Account** may have one **Card Billing Profile**
- A credit-card **Financial Account** may exist without a **Card Billing Profile**
- A **Card Billing Profile** contains one **Statement Closing Day** and one **Payment Due Day**
- A **Card Billing Profile** is user-configured rather than inferred from a **Capture Source**
- A missing **Card Billing Profile** creates a **Billing Profile Gap**
- The user should be told which cycle-aware features are unavailable when a **Billing Profile Gap** exists
- A credit-card **Financial Account** represents debt owed on that card
- A credit-card expense **Transaction** counts as spending on the purchase date, not the later payment date
- A **Billing Profile Gap** disables cycle-aware credit-card features but does not block normal card tracking
- A **Financial Account** may start with one **Opening Balance**
- **Opening Balance** is separate from **Transaction** and **Transfer**
- **Opening Balance** begins affecting balances from one **Opening Balance Effective Date**
- A **Financial Account** balance is derived from **Opening Balance**, **Transactions**, and **Transfers**
- A **Capture Source** may produce transactions for many **Financial Accounts**
- A **Capture Source** may create a **Transfer** directly only when the evidence identifies both sides of the movement
- One-sided capture evidence is insufficient to infer a **Transfer** in v1
- A **Capture Source** provides evidence about a **Financial Account** but is not itself a **Financial Account**
- A **Capture Source** must not auto-create new **Financial Accounts**
- A captured item whose **Financial Meaning** is unclear stays as capture evidence until user review
- A captured item whose **Financial Meaning** is unclear appears in the **Financial Meaning Review Queue**
- **Financial Meaning** is resolved before **Account Attribution** when both are unclear
- Resolving **Financial Meaning** may continue directly into **Account Attribution** in the same user flow
- Resolving **Financial Meaning** as a **Transfer** requires both explicit sides before saving
- A **Financial Account** may own many **Financial Account Identifiers**
- A **Financial Account** may collect optional **Financial Account Identifiers** during setup
- A **Financial Account Identifier** is interpreted within one **Financial Account Identifier Scope**
- **Financial Account Identifier Evidence** is matched against **Financial Account Identifiers**
- **Account Attribution** may learn from **Financial Account Identifier Evidence**
- New **Financial Account Identifiers** may reprocess past unresolved records only
- A wrong learned **Financial Account Identifier** should be weakened or removed after user correction
- Correcting a wrong learned identifier may re-evaluate past inferred records, but not confirmed ones
- **Account Attribution** assigns a **Transaction** to one **Financial Account**
- A **Transaction** has one **Account Attribution State**
- A manually created **Transaction** always has one **Financial Account**, with a default account preselected but editable
- An **inferred** account assignment counts in active balances until corrected
- **Fallback Financial Account** is the user's **Default Financial Account**
- When **Account Attribution** is unresolved, the **Transaction** is still created under one **Fallback Financial Account** until corrected
- An unresolved fallback-assigned **Transaction** is provisional and does not count in account-specific balances
- An unresolved **Transaction** still counts in overall spending or income analytics when its financial meaning is otherwise clear
- An unresolved **Transaction** appears in the **Attribution Review Queue**
- The **Attribution Review Queue** may create a missing **Financial Account** inline before assigning the record
- Resolving an item in the **Attribution Review Queue** may save its captured evidence as new **Financial Account Identifiers**
- Resolving an item in the **Attribution Review Queue** makes its **Account Attribution State** `confirmed`
- The **Attribution Review Queue** may dismiss a capture as not trackable
- A **Dismissed Capture** stays stored as capture evidence but does not become a **Transaction** or **Transfer**
- A **Dismissed Capture** is hidden from normal user flows in v1
- A **Dismissed Capture** syncs so it does not resurface on other devices
- Dismissal is final in v1
- An unresolved **Transaction** still syncs as unresolved and can be corrected later
- When multiple **Financial Accounts** match the same evidence, **Account Attribution** remains unresolved until the user confirms the correct account
- **Reclassification** may convert a captured **Transaction** into a **Transfer**
- **Reclassification** preserves the original **Capture Source** evidence and relinks it to the corrected financial record
- A captured **Transaction** replaced by **Reclassification** becomes a **Superseded Financial Record**
- **Transfer** is not a **Transaction** category

## Example dialogue

> **Dev:** "When an email or notification creates a **Transaction**, do we store which **Financial Account** it belongs to?"
> **Domain expert:** "Yes. The capture source may help identify it, but the **Financial Account** is the bookkeeping owner of the **Transaction**."

## Flagged ambiguities

- "account" was used to mean both a connected email account and the money-holding owner of a transaction. Resolved: use **Financial Account** for the money-holding concept.
- "source" could be mistaken for the owner of a transaction. Resolved: a **Capture Source** is evidence, not identity.
- "transfer" already exists in code as a category label, but the domain now uses **Transfer** as a distinct value movement. Resolved: they are not the same concept.
- the built-in `"transfer"` category conflicts with first-class **Transfer** records. Resolved: remove `"transfer"` as a **Transaction** category.
- credit-card statement dues were close to existing **Bill** language, but they do not behave like ordinary bills. Resolved: use **Card Statement Obligation** for the credit-card case.
- "Activity" came up as a possible umbrella over transactions and transfers. Resolved: not a core domain concept for now; keep **Transaction** and **Transfer** separate and add combined UI projections only when needed.
- credit-card **Card Billing Profile** data is worth storing now, but automatic **Card Statement Obligation** generation is deferred until transfer ingestion and account attribution are stable.
- one-sided payment-like evidence without real-world samples is too broad to classify safely. Resolved: defer one-sided transfer inference in v1.
- overall wealth came up while reasoning about transfers, but it is out of MVP scope and should not drive the current model.
