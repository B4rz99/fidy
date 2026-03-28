import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
struct QuickExpenseControl: ControlWidget {
    static let kind: String = "com.obarbozaa.Fidy.QuickExpenseControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: Self.kind,
            provider: QuickExpenseControlProvider()
        ) { _ in
            ControlWidgetButton(action: QuickExpenseIntent()) {
                Label("Fidy", systemImage: "dollarsign.circle.fill")
            }
        }
        .displayName("Log Expense")
        .description("Quickly log an expense from Control Center.")
    }
}

@available(iOS 18.0, *)
struct QuickExpenseControlProvider: ControlValueProvider {
    typealias Value = Bool

    var previewValue: Bool { false }

    func currentValue() async throws -> Bool { false }
}
