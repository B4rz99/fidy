import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
@main
struct FidyWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickExpenseControl()
    }
}
