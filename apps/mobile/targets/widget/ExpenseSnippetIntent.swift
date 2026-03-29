import AppIntents
import SwiftUI

@available(iOS 26.0, *)
struct ExpenseSnippetIntent: SnippetIntent {
    static let title: LocalizedStringResource = "Expense Amount Picker"

    func perform() async throws -> some IntentResult & ShowsSnippetView {
        return .result(view: ExpenseAmountView())
    }
}

@available(iOS 26.0, *)
struct ExpenseAmountView: View {
    private let amounts = [
        5_000, 10_000, 15_000, 20_000,
        30_000, 50_000, 75_000, 100_000,
    ]

    var body: some View {
        VStack(spacing: 12) {
            Text("Log Expense")
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 8) {
                ForEach(amounts, id: \.self) { amount in
                    Button(intent: SaveExpenseIntent(amount: amount)) {
                        Text(formatAmount(amount))
                            .font(.callout.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding()
    }

    private func formatAmount(_ amount: Int) -> String {
        if amount >= 1000 {
            return "\(amount / 1000)K"
        }
        return "\(amount)"
    }
}
