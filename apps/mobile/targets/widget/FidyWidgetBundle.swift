import SwiftUI
import WidgetKit

// This widget bundle is intentionally empty — we only need the extension target
// to host App Intents for Back Tap / Shortcuts integration.
// Control Center widget has been removed.
@main
struct FidyWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Empty — no widgets. The extension exists only to host App Intents.
        // Swift compiler requires at least one Widget in the bundle,
        // but App Intents are discovered automatically from the extension.
        EmptyWidget()
    }
}

struct EmptyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.obarbozaa.Fidy.Empty", provider: EmptyProvider()) { _ in
            EmptyView()
        }
        .configurationDisplayName("Fidy")
        .description("Back Tap shortcuts support")
    }
}

struct EmptyProvider: TimelineProvider {
    func placeholder(in context: Context) -> EmptyEntry {
        EmptyEntry()
    }
    
    func getSnapshot(in context: Context, completion: @escaping (EmptyEntry) -> Void) {
        completion(EmptyEntry())
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<EmptyEntry>) -> Void) {
        completion(Timeline(entries: [EmptyEntry()], policy: .never))
    }
}

struct EmptyEntry: TimelineEntry {
    let date = Date()
}
