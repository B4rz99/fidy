import AppIntents
import Foundation

// Using NSLog for visibility in Console app
func log(_ message: String) {
    NSLog("[FIDY_INTENT] \(message)")
}

// Log when this file is loaded
log("QuickExpenseIntent.swift loaded")

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
        log("perform() called with amount=\(amount), category=\(category.rawValue), type=\(type.rawValue)")
        
        guard amount > 0 else {
            log("Invalid amount: \(amount)")
            throw $amount.needsValueError("Please enter a positive amount.")
        }

        let defaults = UserDefaults(suiteName: APP_GROUP_SUITE_NAME)

        guard let defaults else {
            log("UserDefaults(suiteName:) returned nil — App Group entitlement may be missing")
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
            log("Wrote transaction \(entryId) to suite \(APP_GROUP_SUITE_NAME)")
            
            // Immediately read back to verify write succeeded
            if let verifyData = defaults.data(forKey: PENDING_TRANSACTIONS_KEY) {
                log("Verified write: \(verifyData.count) bytes in UserDefaults")
            }
        } catch {
            log("JSONSerialization failed: \(error.localizedDescription)")
        }

        return .result()
    }
}
