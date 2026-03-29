import AppIntents

struct OpenAddTransactionIntent: AppIntent {
    static let title: LocalizedStringResource = "Log Expense"
    static let description = IntentDescription("Quickly log an expense from Control Center.")

    func perform() async throws -> some IntentResult & ShowsSnippetIntent {
        return .result(snippetIntent: ExpenseSnippetIntent())
    }
}
