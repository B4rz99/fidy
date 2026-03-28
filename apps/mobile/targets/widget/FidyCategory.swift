import AppIntents

@available(iOS 18.0, *)
enum FidyCategory: String, AppEnum {
    case food, transport, entertainment, health, education
    case home, clothing, services, transfer, other

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Category")
    static var caseDisplayRepresentations: [FidyCategory: DisplayRepresentation] = [
        .food: "Food",
        .transport: "Transport",
        .entertainment: "Entertainment",
        .health: "Health",
        .education: "Education",
        .home: "Home",
        .clothing: "Clothing",
        .services: "Services",
        .transfer: "Transfer",
        .other: "Other",
    ]
}
