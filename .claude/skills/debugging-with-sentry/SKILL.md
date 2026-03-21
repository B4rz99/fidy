---
name: debugging-with-sentry
description: Use when investigating user-reported bugs, silent failures, duplicate transactions, missing data, sync issues, or any production problem. Sentry is the primary observability tool — check it before reading code.
---

# Debugging with Sentry

Sentry is the primary tool for debugging user issues. Every critical path in the app reports structured events. Before investigating code, check Sentry for the user's event trail.

## Privacy Constraint

Sentry events contain **only structural metadata** — counts, statuses, error types, timing. Never merchant names, amounts, email content, or chat messages. If you need transaction-level detail, you must query the Supabase `transactions` table directly (no `source` column there — it's local-only).

## Quick Reference: Sentry Events

### Pipeline Events (`capturePipelineEvent` — level: info)

Filter by message `pipeline:<source>` in Sentry.

| Message | Key Fields | What It Tells You |
|---------|-----------|------------------|
| `pipeline:email` | `batchSize`, `uniqueProviders`, `dedupedInBatch`, `skippedAlreadyProcessed`, `skippedCrossSource`, `saved`, `failed`, `needsReview` | Full email sync outcome. `dedupedInBatch > 0` = duplicate emails in batch (same account connected twice). `uniqueProviders` = how many providers fetched. |
| `pipeline:notification` | `bankSource`, `parseMethod`, `saved`, `skippedDuplicate`, `parseFailed` | Per-notification outcome. `bankSource` = which bank (e.g., `notification_bancolombia`). `parseMethod` = `regex` or `llm`. |
| `pipeline:apple_pay` | `saved`, `skippedDuplicate` | Per-intent outcome. |
| `pipeline:sync_push` | `queued`, `succeeded`, `failed` | Sync push batch result. |
| `pipeline:sync_pull` | `rowsFetched`, `rowsApplied`, `conflicts`, `failed` | Sync pull batch result. `failed > 0` with repeated events = stuck sync. |

### Warnings (`captureWarning` — level: warning)

| Message | Key Fields | Means |
|---------|-----------|-------|
| `email_token_refresh_failed` | `provider`, `httpStatus` | OAuth token died. User's email sync is silently broken. |
| `gmail_api_list_failed` | `httpStatus` | Gmail API error (401=revoked, 403=quota, 429=rate limit). |
| `outlook_api_list_failed` | `httpStatus` | Same for Outlook. |
| `email_adapter_fetch_failed` | `provider`, `errorType` | Email fetch threw an exception. |
| `email_parse_exception` | `provider`, `errorType` | LLM parse threw during email processing. |
| `email_retry_parse_exception` | `provider`, `errorType` | LLM parse threw during retry. |
| `parse_email_api_failed` | `errorMessage`, `hasData` | Edge Function returned error or empty. |
| `parse_email_validation_failed` | `issueCount` | LLM output failed Zod validation. |
| `parse_email_api_exception` | `errorType` | Edge Function call threw. |
| `classify_merchant_failed` | `hasError`, `errorMessage` | Merchant classification Edge Function failed. |
| `parse_notification_api_failed` | `errorMessage`, `hasData` | Notification Edge Function error. |
| `parse_notification_validation_failed` | `issueCount` | Notification LLM output failed validation. |
| `parse_notification_api_exception` | `errorType` | Notification Edge Function threw. |
| `bank_senders_fetch_failed` | `errorMessage` | Bank senders Supabase query failed, using defaults. |
| `bank_senders_exception` | `errorType` | Bank senders fetch threw. |
| `sync_push_entry_failed` | `tableName`, `errorMessage`, `errorCode` | Supabase upsert failed for a specific table. |
| `sync_push_unknown_table` | `tableName` | Sync queue has entry for unhandled table. |
| `sync_pull_fetch_failed` | `errorMessage`, `errorCode` | Supabase pull query failed. |
| `background_sync_failed` | `errorType` | Background sync hook threw. |
| `auth_restore_failed` | `errorMessage` | Session restore from Supabase failed. |
| `auth_restore_exception` | `errorType` | Session restore threw. |
| `auth_signin_failed` | `errorType` | Sign-in OAuth flow threw. |
| `ai_action_failed` | `actionType`, `errorType` | AI chat action (add/edit/delete) threw. |

### Errors (`captureError` — level: error)

Thrown exceptions from: migration failures, sync conflicts, transaction save errors, email pipeline save errors, background task crashes. These create standard Sentry error events with stack traces.

## Debugging Playbook

### "User reports duplicate transactions"
1. Filter Sentry for user ID + `pipeline:email`
2. Check `dedupedInBatch` — if > 0, same account was connected twice
3. Check `skippedCrossSource` — if 0 with `saved > 1`, dedup didn't catch a pair
4. Query Supabase `transactions` table for same `user_id + amount + date` pairs

### "User says transactions stopped appearing"
1. Search for `email_token_refresh_failed` for that user
2. Check `gmail_api_list_failed` / `outlook_api_list_failed` for HTTP status
3. Check `pipeline:email` — if `batchSize: 0` repeatedly, emails aren't being fetched
4. Check `bank_senders_fetch_failed` — if senders list is broken, no emails match

### "User's data isn't syncing"
1. Filter for `pipeline:sync_push` — check `failed` count
2. Check `sync_push_entry_failed` for specific `tableName` and `errorCode`
3. Check `pipeline:sync_pull` — if `failed > 0` in repeated events, sync is stuck
4. Check `sync_pull_fetch_failed` for Supabase query errors

### "AI chat said it added an expense but nothing showed up"
1. Search for `ai_action_failed` — check `errorType`
2. If no warning exists, the action succeeded but might have wrong data

### "User can't log in"
1. Search for `auth_restore_failed` or `auth_signin_failed`
2. Check `errorMessage` / `errorType` for Supabase auth details

### "App crashes on launch"
1. Check for migration errors (standard Sentry error events)
2. Check `auth_restore_exception` — session restore might be crashing

## User Identity

All Sentry events are tied to a user via `Sentry.setUser({ id: userId })`, set on session change in `_layout.tsx`. Filter by user ID in Sentry to see their full event trail.

## Sentry MCP

A Sentry MCP server is available. Use `ToolSearch` to find `mcp__sentry` tools for querying issues, events, and user trails directly from the conversation without opening the Sentry dashboard.

## Helpers

- `shared/lib/sentry.ts` — `capturePipelineEvent(data)`, `captureWarning(message, context)`, `captureError(error)`, `setSentryUser(userId)`
- All exported from `shared/lib/index.ts`
- Data type is `Record<string, string | number | boolean>` — no nested objects, no PII
