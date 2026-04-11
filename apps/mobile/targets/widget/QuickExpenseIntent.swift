import AppIntents
import Foundation

struct QuickExpenseIntent: AppIntent {
    static let title: LocalizedStringResource = "Log Quick Expense"
    static let description = IntentDescription("Log a transaction with amount, category, and type.")

    @Parameter(title: "Amount")
    var amount: Int

    @Parameter(title: "Category")
    var category: FidyCategory

    @Parameter(title: "Type")
    var type: TransactionKind

    @Parameter(title: "Description", default: "")
    var descriptionText: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$amount) \(\.$type)") {
            \.$category
            \.$descriptionText
        }
    }

    func perform() async throws -> some IntentResult {
        guard amount > 0 else {
            throw $amount.needsValueError("Please enter a positive amount.")
        }

        let defaults = UserDefaults(suiteName: APP_GROUP_SUITE_NAME)

        guard let defaults else {
            return .result()
        }

        let existing: [[String: Any]] = {
            guard
                let data = defaults.data(forKey: PENDING_TRANSACTIONS_KEY),
                let decoded = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
            else {
                return []
            }
            return decoded
        }()

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let timestamp = formatter.string(from: Date())

        let entryId = UUID().uuidString
        let newEntry: [String: Any] = [
            "id": entryId,
            "amount": amount,
            "category": category.rawValue,
            "type": type.rawValue,
            "description": descriptionText ?? "",
            "createdAt": timestamp,
        ]

        let updated = existing + [newEntry]

        do {
            let encoded = try JSONSerialization.data(withJSONObject: updated)
            defaults.set(encoded, forKey: PENDING_TRANSACTIONS_KEY)
        } catch {
            // Silent failure - transaction will be retried on next app launch
        }

        return .result()
    }
}
