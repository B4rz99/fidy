export type FinancialContextPacketTaskKind =
  | "general_advisor"
  | "spending_overview"
  | "goal_progress"
  | "account_overview"
  | "capture_review";

export type FinancialContextPacketTask = {
  readonly kind: FinancialContextPacketTaskKind;
};

export type FinancialContextCategoryTotal = {
  readonly categoryId: string;
  readonly total: number;
};

export type FinancialContextCategoryDelta = {
  readonly categoryId: string;
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
};

export type FinancialContextGoalSummary = {
  readonly name: string;
  readonly type: string;
  readonly targetAmount: number;
  readonly currentAmount: number;
  readonly progressPct: number;
};

export type FinancialContextPacket = {
  readonly task: FinancialContextPacketTask;
  readonly summary?: {
    readonly balance: number;
    readonly currentMonthSpending: readonly FinancialContextCategoryTotal[];
    readonly previousMonthSpending: readonly FinancialContextCategoryTotal[];
    readonly monthOverMonthDeltas: readonly FinancialContextCategoryDelta[];
  };
  readonly recentTransactions?: readonly {
    readonly type: string;
    readonly amount: number;
    readonly categoryId: string;
    readonly description: string;
    readonly date: string;
  }[];
  readonly budgets?: readonly {
    readonly categoryId: string;
    readonly amount: number;
    readonly month: string;
  }[];
  readonly goals?: readonly FinancialContextGoalSummary[];
  readonly accounts?: readonly {
    readonly name: string;
    readonly kind: string;
    readonly isDefault: boolean;
  }[];
  readonly captureEvidence?: readonly {
    readonly scope: string;
    readonly value: string;
    readonly sourceFamily: string;
    readonly evidenceType: string;
    readonly occurrences: number;
  }[];
};

type PacketSection =
  | "summary"
  | "recentTransactions"
  | "budgets"
  | "goals"
  | "accounts"
  | "captureEvidence";

type ArrayPacketSection = Exclude<PacketSection, "summary">;

type OptionalArrayRead<T> =
  | { readonly valid: true; readonly value?: readonly T[] }
  | { readonly valid: false };

type OptionalRead<T> = { readonly valid: true; readonly value?: T } | { readonly valid: false };

const TASK_KINDS = new Set<FinancialContextPacketTaskKind>([
  "general_advisor",
  "spending_overview",
  "goal_progress",
  "account_overview",
  "capture_review",
]);

const ALLOWED_SECTIONS_BY_TASK: Record<FinancialContextPacketTaskKind, readonly PacketSection[]> = {
  general_advisor: [],
  spending_overview: ["summary", "recentTransactions", "budgets"],
  goal_progress: ["goals"],
  account_overview: ["summary", "accounts"],
  capture_review: ["captureEvidence"],
};

const MAX_SUMMARY_ITEMS = 20;
const MAX_RECENT_TRANSACTIONS = 20;
const MAX_BUDGETS = 20;
const MAX_GOALS = 20;
const MAX_ACCOUNTS = 20;
const MAX_CAPTURE_EVIDENCE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readArray<T>(
  value: unknown,
  maxLength: number,
  readItem: (item: unknown) => T | null
): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.slice(0, maxLength).map(readItem);
  return items.every(isPresent) ? items : null;
}

const containsAny = (text: string, terms: readonly string[]): boolean =>
  terms.some((term) => text.includes(term));

function readMessageText(value: unknown): string | null {
  if (!isRecord(value) || value.role !== "user") return null;
  return readString(value.content);
}

export function inferFinancialContextPacketTaskFromMessages(
  messages: readonly unknown[]
): FinancialContextPacketTaskKind {
  const userTexts = messages.map(readMessageText).filter(isPresent);
  const normalized = (userTexts[userTexts.length - 1] ?? "").toLocaleLowerCase();

  if (containsAny(normalized, ["account", "accounts", "cuenta", "cuentas", "card", "tarjeta"])) {
    return "account_overview";
  }
  if (containsAny(normalized, ["goal", "goals", "meta", "metas", "ahorro", "savings"])) {
    return "goal_progress";
  }
  if (containsAny(normalized, ["capture", "email", "notification", "correo", "notificacion"])) {
    return "capture_review";
  }
  return "spending_overview";
}

function readCategoryTotal(value: unknown): FinancialContextCategoryTotal | null {
  if (!isRecord(value)) return null;
  const categoryId = readString(value.categoryId);
  const total = readNumber(value.total);
  return categoryId !== null && total !== null ? { categoryId, total } : null;
}

function readCategoryDelta(value: unknown): FinancialContextCategoryDelta | null {
  if (!isRecord(value)) return null;
  const categoryId = readString(value.categoryId);
  const current = readNumber(value.current);
  const previous = readNumber(value.previous);
  const delta = readNumber(value.delta);
  return categoryId !== null && current !== null && previous !== null && delta !== null
    ? { categoryId, current, previous, delta }
    : null;
}

function readSummary(value: unknown): NonNullable<FinancialContextPacket["summary"]> | null {
  if (!isRecord(value)) return null;
  const balance = readNumber(value.balance);
  const currentMonthSpending = readArray(
    value.currentMonthSpending,
    MAX_SUMMARY_ITEMS,
    readCategoryTotal
  );
  const previousMonthSpending = readArray(
    value.previousMonthSpending,
    MAX_SUMMARY_ITEMS,
    readCategoryTotal
  );
  const monthOverMonthDeltas = readArray(
    value.monthOverMonthDeltas,
    MAX_SUMMARY_ITEMS,
    readCategoryDelta
  );
  return balance !== null &&
    currentMonthSpending !== null &&
    previousMonthSpending !== null &&
    monthOverMonthDeltas !== null
    ? { balance, currentMonthSpending, previousMonthSpending, monthOverMonthDeltas }
    : null;
}

function readRecentTransaction(
  value: unknown
): NonNullable<FinancialContextPacket["recentTransactions"]>[number] | null {
  if (!isRecord(value)) return null;
  const type = readString(value.type);
  const amount = readNumber(value.amount);
  const categoryId = readString(value.categoryId);
  const description = readString(value.description);
  const date = readString(value.date);
  return type !== null &&
    amount !== null &&
    categoryId !== null &&
    description !== null &&
    date !== null
    ? { type, amount, categoryId, description, date }
    : null;
}

function readBudget(value: unknown): NonNullable<FinancialContextPacket["budgets"]>[number] | null {
  if (!isRecord(value)) return null;
  const categoryId = readString(value.categoryId);
  const amount = readNumber(value.amount);
  const month = readString(value.month);
  return categoryId !== null && amount !== null && month !== null
    ? { categoryId, amount, month }
    : null;
}

function readGoal(value: unknown): FinancialContextGoalSummary | null {
  if (!isRecord(value)) return null;
  const name = readString(value.name);
  const type = readString(value.type);
  const targetAmount = readNumber(value.targetAmount);
  const currentAmount = readNumber(value.currentAmount);
  const progressPct = readNumber(value.progressPct);
  return name !== null &&
    type !== null &&
    targetAmount !== null &&
    currentAmount !== null &&
    progressPct !== null
    ? { name, type, targetAmount, currentAmount, progressPct }
    : null;
}

function readAccount(
  value: unknown
): NonNullable<FinancialContextPacket["accounts"]>[number] | null {
  if (!isRecord(value)) return null;
  const name = readString(value.name);
  const kind = readString(value.kind);
  const isDefault = readBoolean(value.isDefault);
  return name !== null && kind !== null && isDefault !== null ? { name, kind, isDefault } : null;
}

function readCaptureEvidence(
  value: unknown
): NonNullable<FinancialContextPacket["captureEvidence"]>[number] | null {
  if (!isRecord(value)) return null;
  const scope = readString(value.scope);
  const evidenceValue = readString(value.value);
  const sourceFamily = readString(value.sourceFamily);
  const evidenceType = readString(value.evidenceType);
  const occurrences = readNumber(value.occurrences);
  return scope !== null &&
    evidenceValue !== null &&
    sourceFamily !== null &&
    evidenceType !== null &&
    occurrences !== null
    ? { scope, value: evidenceValue, sourceFamily, evidenceType, occurrences }
    : null;
}

function hasPacketSection(record: Record<string, unknown>, section: PacketSection): boolean {
  return section in record && record[section] !== undefined;
}

function readOptionalSummarySection(
  record: Record<string, unknown>,
  task: FinancialContextPacketTask
): OptionalRead<NonNullable<FinancialContextPacket["summary"]>> {
  const allowsSummary = ALLOWED_SECTIONS_BY_TASK[task.kind].includes("summary");
  if (!hasPacketSection(record, "summary")) {
    return task.kind === "spending_overview" ? { valid: false } : { valid: true };
  }
  if (!allowsSummary) return { valid: true };
  const summary = readSummary(record.summary);
  return summary === null ? { valid: false } : { valid: true, value: summary };
}

function readOptionalArraySection<T>(
  record: Record<string, unknown>,
  task: FinancialContextPacketTask,
  section: ArrayPacketSection,
  maxLength: number,
  readItem: (item: unknown) => T | null
): OptionalArrayRead<T> {
  if (!ALLOWED_SECTIONS_BY_TASK[task.kind].includes(section)) return { valid: true };
  if (!hasPacketSection(record, section)) return { valid: true };
  const value = readArray(record[section], maxLength, readItem);
  return value === null ? { valid: false } : { valid: true, value };
}

export function readFinancialContextPacket(
  value: unknown,
  taskKind: FinancialContextPacketTaskKind
): FinancialContextPacket | null {
  if (!isRecord(value)) return null;
  if (!TASK_KINDS.has(taskKind)) return null;
  const task = { kind: taskKind };
  const summary = readOptionalSummarySection(value, task);
  if (!summary.valid) return null;

  const recentTransactions = readOptionalArraySection(
    value,
    task,
    "recentTransactions",
    MAX_RECENT_TRANSACTIONS,
    readRecentTransaction
  );
  const budgets = readOptionalArraySection(value, task, "budgets", MAX_BUDGETS, readBudget);
  const goals = readOptionalArraySection(value, task, "goals", MAX_GOALS, readGoal);
  const accounts = readOptionalArraySection(value, task, "accounts", MAX_ACCOUNTS, readAccount);
  const captureEvidence = readOptionalArraySection(
    value,
    task,
    "captureEvidence",
    MAX_CAPTURE_EVIDENCE,
    readCaptureEvidence
  );

  if (
    !recentTransactions.valid ||
    !budgets.valid ||
    !goals.valid ||
    !accounts.valid ||
    !captureEvidence.valid
  ) {
    return null;
  }

  return {
    task,
    ...(summary.value !== undefined ? { summary: summary.value } : {}),
    ...(recentTransactions.value !== undefined
      ? { recentTransactions: recentTransactions.value }
      : {}),
    ...(budgets.value !== undefined ? { budgets: budgets.value } : {}),
    ...(goals.value !== undefined ? { goals: goals.value } : {}),
    ...(accounts.value !== undefined ? { accounts: accounts.value } : {}),
    ...(captureEvidence.value !== undefined ? { captureEvidence: captureEvidence.value } : {}),
  };
}
