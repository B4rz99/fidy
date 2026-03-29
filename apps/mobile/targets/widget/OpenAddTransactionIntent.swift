import AppIntents

@available(iOS 18.0, *)
struct OpenAddTransactionIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Add Transaction"
    static let description = IntentDescription("Opens Fidy to the Add Transaction screen.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
