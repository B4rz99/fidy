import AppIntents
import Foundation
import os

private let logger = Logger(subsystem: "com.obarbozaa.Fidy", category: "QuickExpenseIntent")

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

        let defaults = UserDefaults(suiteName: "group.com.obarbozaa.Fidy")

        guard let defaults else {
            logger.error("UserDefaults(suiteName:) returned nil — App Group entitlement may be missing")
            return .result()
        }

        let existing: [[String: Any]] = {
            guard
                let data = defaults.data(forKey: "pendingWidgetTransactions"),
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
            defaults.set(encoded, forKey: "pendingWidgetTransactions")
            logger.debug("Wrote transaction \(entryId)")
        } catch {
            logger.error("JSONSerialization failed: \(error.localizedDescription)")
        }

        return .result()
    }
}
