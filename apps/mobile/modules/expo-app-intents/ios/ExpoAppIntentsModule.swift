import ExpoModulesCore

public class ExpoAppIntentsModule: Module {
  private let suiteName = "group.com.obarbozaa.Fidy"
  private let pendingTransactionsKey = "pendingWidgetTransactions"

  public func definition() -> ModuleDefinition {
    Name("ExpoAppIntents")

    Events("onLogTransaction", "onDetectBankSms")

    Function("isAvailable") { () -> Bool in
      return true
    }

    AsyncFunction("getPendingTransactions") { () -> [[String: Any]] in
      guard let defaults = UserDefaults(suiteName: self.suiteName) else {
        return []
      }
      guard let data = defaults.data(forKey: self.pendingTransactionsKey) else {
        return []
      }
      guard
        let decoded = try? JSONSerialization.jsonObject(with: data),
        let array = decoded as? [[String: Any]]
      else {
        return []
      }
      return array
    }

    AsyncFunction("clearPendingTransactions") { () -> Void in
      guard let defaults = UserDefaults(suiteName: self.suiteName) else {
        return
      }
      defaults.removeObject(forKey: self.pendingTransactionsKey)
    }
  }
}
