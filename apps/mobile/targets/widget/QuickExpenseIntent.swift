import AppIntents
import Foundation

@available(iOS 18.0, *)
struct QuickExpenseIntent: AppIntent {
    static let title: LocalizedStringResource = "Log Quick Expense"
    static let description = IntentDescription("Log an expense amount from Control Center.")

    @Parameter(title: "Amount")
    var amount: Int

    @Parameter(title: "Category", default: .other)
    var category: FidyCategory?

    @Parameter(title: "Type", default: .expense)
    var type: TransactionKind?

    @Parameter(title: "Description")
    var descriptionText: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$amount) expense") {
            \.$category
            \.$type
            \.$descriptionText
        }
    }

    func perform() async throws -> some IntentResult {
        guard amount > 0 else {
            throw $amount.needsValueError("Please enter a positive amount.")
        }

        let defaults = UserDefaults(suiteName: "group.com.obarbozaa.Fidy")

        let existing: [[String: Any]] = {
            guard
                let data = defaults?.data(forKey: "pendingWidgetTransactions"),
                let decoded = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
            else { return [] }
            return decoded
        }()

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let timestamp = formatter.string(from: Date())

        let newEntry: [String: Any] = [
            "id": UUID().uuidString,
            "amount": amount,
            "category": (category ?? .other).rawValue,
            "type": (type ?? .expense).rawValue,
            "description": descriptionText ?? "",
            "createdAt": timestamp,
        ]

        let updated = existing + [newEntry]

        if let encoded = try? JSONSerialization.data(withJSONObject: updated) {
            defaults?.set(encoded, forKey: "pendingWidgetTransactions")
        }

        return .result()
    }
}
