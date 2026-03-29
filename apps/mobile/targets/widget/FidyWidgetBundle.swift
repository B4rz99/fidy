import SwiftUI
import WidgetKit

@available(iOS 26.0, *)
@main
struct FidyWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickExpenseControl()
    }
}
