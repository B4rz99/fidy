import AppIntents

@available(iOS 18.0, *)
enum TransactionKind: String, AppEnum {
    case expense, income

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Type")
    static var caseDisplayRepresentations: [TransactionKind: DisplayRepresentation] = [
        .expense: "Expense",
        .income: "Income",
    ]
}
