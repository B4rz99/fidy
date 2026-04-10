import ExpoModulesCore

public class ExpoAppIntentsModule: Module {
  private let pendingTransactionsKey = "pendingWidgetTransactions"

  private lazy var suiteName: String = {
    if let infoPlistName = Bundle.main.infoDictionary?["FidyAppGroupSuiteName"] as? String {
      return infoPlistName
    }
    return "group.com.obarbozaa.Fidy"
  }()

  public func definition() -> ModuleDefinition {
    Name("ExpoAppIntents")

    Events("onLogTransaction", "onDetectBankSms")

    Function("isAvailable") { () -> Bool in
      return true
    }

    AsyncFunction("getPendingTransactions") { () -> [[String: Any]] in
      print("[ExpoAppIntents] Reading from suite: \(self.suiteName), key: \(self.pendingTransactionsKey)")
      
      guard let defaults = UserDefaults(suiteName: self.suiteName) else {
        print("[ExpoAppIntents] ERROR: Could not access UserDefaults with suite \(self.suiteName)")
        return []
      }
      
      guard let data = defaults.data(forKey: self.pendingTransactionsKey) else {
        print("[ExpoAppIntents] No data found for key \(self.pendingTransactionsKey)")
        return []
      }
      
      print("[ExpoAppIntents] Found \(data.count) bytes of data")
      
      guard
        let decoded = try? JSONSerialization.jsonObject(with: data),
        let array = decoded as? [[String: Any]]
      else {
        print("[ExpoAppIntents] ERROR: Failed to decode JSON data")
        return []
      }
      
      print("[ExpoAppIntents] Successfully decoded \(array.count) transactions")
      return array
    }

    AsyncFunction("removePendingTransactions") { (ids: [String]) -> Void in
      guard let defaults = UserDefaults(suiteName: self.suiteName) else {
        return
      }
      guard let data = defaults.data(forKey: self.pendingTransactionsKey),
            let decoded = try? JSONSerialization.jsonObject(with: data),
            let array = decoded as? [[String: Any]] else {
        return
      }
      let idsToRemove = Set(ids)
      let remaining = array.filter { entry in
        guard let entryId = entry["id"] as? String else { return false }
        return !idsToRemove.contains(entryId)
      }
      if remaining.isEmpty {
        defaults.removeObject(forKey: self.pendingTransactionsKey)
      } else if let encoded = try? JSONSerialization.data(withJSONObject: remaining) {
        defaults.set(encoded, forKey: self.pendingTransactionsKey)
      }
    }
  }
}
