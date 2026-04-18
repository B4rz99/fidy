import { getBuiltInCategoryId } from "@/features/transactions";
import type { Bill } from "../schema";

const SERVICES_CATEGORY_ID = getBuiltInCategoryId("services");

export const MOCK_BILLS: Bill[] = [
  {
    id: "bill-1",
    name: "Netflix",
    amount: 17900,
    frequency: "monthly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 0, 15),
    isActive: true,
  },
  {
    id: "bill-2",
    name: "Spotify",
    amount: 15900,
    frequency: "monthly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 1, 3),
    isActive: true,
  },
  {
    id: "bill-3",
    name: "Electric",
    amount: 85000,
    frequency: "monthly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 0, 20),
    isActive: true,
  },
  {
    id: "bill-4",
    name: "Gym",
    amount: 120000,
    frequency: "monthly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 2, 1),
    isActive: true,
  },
  {
    id: "bill-5",
    name: "Cloud Storage",
    amount: 5900,
    frequency: "monthly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 0, 10),
    isActive: true,
  },
  {
    id: "bill-6",
    name: "Insurance",
    amount: 450000,
    frequency: "yearly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 2, 22),
    isActive: true,
  },
  {
    id: "bill-7",
    name: "Internet",
    amount: 75000,
    frequency: "monthly",
    categoryId: SERVICES_CATEGORY_ID,
    startDate: new Date(2025, 0, 28),
    isActive: true,
  },
];
