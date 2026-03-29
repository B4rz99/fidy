import AppIntents
import SwiftUI
import WidgetKit

struct QuickExpenseControl: ControlWidget {
    static let kind: String = "com.obarbozaa.Fidy.QuickExpenseControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenAddTransactionIntent()) {
                Label("Fidy", systemImage: "dollarsign.circle.fill")
            }
        }
        .displayName("Log Expense")
        .description("Quickly log an expense from Control Center.")
    }
}
