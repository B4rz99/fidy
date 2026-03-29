import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
struct QuickExpenseControl: ControlWidget {
    static let kind: String = "com.obarbozaa.Fidy.QuickExpenseControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenAddTransactionIntent()) {
                Label("Fidy", systemImage: "dollarsign.circle.fill")
            }
        }
        .displayName("Log Expense")
        .description("Opens Fidy to quickly log an expense.")
    }
}
