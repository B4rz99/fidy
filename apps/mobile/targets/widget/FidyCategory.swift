// Category raw values MUST stay in sync with the canonical JS source:
// apps/mobile/features/transactions/lib/categories.ts
import AppIntents

enum FidyCategory: String, AppEnum {
    case food, transport, entertainment, health, education
    case home, clothing, services, transfer, other

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Category")
    static let caseDisplayRepresentations: [FidyCategory: DisplayRepresentation] = [
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
