import AppIntents

@available(iOS 26.0, *)
enum TransactionKind: String, AppEnum {
    case expense, income

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Type")
    static let caseDisplayRepresentations: [TransactionKind: DisplayRepresentation] = [
        .expense: "Expense",
        .income: "Income",
    ]
}
