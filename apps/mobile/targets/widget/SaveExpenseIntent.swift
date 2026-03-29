import AppIntents
import Foundation

struct SaveExpenseIntent: AppIntent {
    static let title: LocalizedStringResource = "Save Quick Expense"

    @Parameter(title: "Amount")
    var amount: Int

    init() {}

    init(amount: Int) {
        self.amount = amount
    }

    func perform() async throws -> some IntentResult {
        guard amount > 0 else { return .result() }

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

        let newEntry: [String: Any] = [
            "id": UUID().uuidString,
            "amount": amount,
            "category": "other",
            "type": "expense",
            "description": "",
            "createdAt": formatter.string(from: Date()),
        ]

        let updated = existing + [newEntry]

        if let encoded = try? JSONSerialization.data(withJSONObject: updated) {
            defaults?.set(encoded, forKey: "pendingWidgetTransactions")
        }

        return .result()
    }
}
