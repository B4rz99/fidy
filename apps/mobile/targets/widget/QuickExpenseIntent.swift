import AppIntents
import Foundation

@available(iOS 18.0, *)
struct QuickExpenseIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Quick Expense"
    static var description = IntentDescription("Log an expense amount from Control Center.")

    @Parameter(title: "Amount")
    var amount: Int

    func perform() async throws -> some IntentResult {
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
            "createdAt": timestamp
        ]

        let updated = existing + [newEntry]

        if let encoded = try? JSONSerialization.data(withJSONObject: updated) {
            defaults?.set(encoded, forKey: "pendingWidgetTransactions")
            defaults?.synchronize()
        }

        return .result()
    }
}
