import type { LucideIcon } from "lucide-react-native";
import {
  Banknote,
  Car,
  Coffee,
  Film,
  HeartPulse,
  Music,
  ShoppingBag,
  Smartphone,
  Wifi,
  Zap,
} from "lucide-react-native";
import { Colors } from "@/shared/constants/theme";

export type BalanceData = {
  readonly total: string;
  readonly trend: string;
  readonly trendLabel: string;
};

export type ChartCategory = {
  readonly name: string;
  readonly amount: string;
  readonly percentage: number;
  readonly color: string;
};

export type Transaction = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly name: string;
  readonly date: string;
  readonly amount: string;
  readonly category: string;
  readonly isPositive: boolean;
  readonly iconBgColor?: { light: string; dark: string };
};

export const balanceData: BalanceData = {
  total: "$12,450.00",
  trend: "+2.4%",
  trendLabel: "this month",
};

export const chartCategories: readonly ChartCategory[] = [
  { name: "Food", amount: "$2,884", percentage: 35, color: Colors.chart.food },
  { name: "Transport", amount: "$2,060", percentage: 25, color: Colors.chart.transport },
  { name: "Shopping", amount: "$1,648", percentage: 20, color: Colors.chart.shopping },
  { name: "Bills", amount: "$1,236", percentage: 15, color: Colors.chart.bills },
  { name: "Other", amount: "$412", percentage: 5, color: Colors.chart.other },
];

export const chartTotal = "$8,240";

export const recentTransactions: readonly Transaction[] = [
  {
    id: "tx-1",
    icon: ShoppingBag,
    name: "Whole Foods",
    date: "Feb 28, 2026",
    amount: "-$45.20",
    category: "Food",
    isPositive: false,
  },
  {
    id: "tx-2",
    icon: Car,
    name: "Uber",
    date: "Feb 27, 2026",
    amount: "-$18.50",
    category: "Transport",
    isPositive: false,
  },
  {
    id: "tx-3",
    icon: Zap,
    name: "Electric Company",
    date: "Feb 25, 2026",
    amount: "-$120.00",
    category: "Bills",
    isPositive: false,
  },
  {
    id: "tx-4",
    icon: Banknote,
    name: "Salary Deposit",
    date: "Feb 24, 2026",
    amount: "+$3,200.00",
    category: "Income",
    isPositive: true,
    iconBgColor: { light: "#D4EDBA", dark: "#1A2E12" },
  },
  {
    id: "tx-5",
    icon: Coffee,
    name: "Starbucks",
    date: "Feb 23, 2026",
    amount: "-$6.75",
    category: "Food",
    isPositive: false,
  },
  {
    id: "tx-6",
    icon: Wifi,
    name: "Internet Bill",
    date: "Feb 22, 2026",
    amount: "-$59.99",
    category: "Bills",
    isPositive: false,
  },
  {
    id: "tx-7",
    icon: Film,
    name: "Netflix",
    date: "Feb 21, 2026",
    amount: "-$15.99",
    category: "Other",
    isPositive: false,
  },
  {
    id: "tx-8",
    icon: Smartphone,
    name: "Apple Store",
    date: "Feb 20, 2026",
    amount: "-$999.00",
    category: "Shopping",
    isPositive: false,
  },
  {
    id: "tx-9",
    icon: HeartPulse,
    name: "Gym Membership",
    date: "Feb 19, 2026",
    amount: "-$49.99",
    category: "Other",
    isPositive: false,
  },
  {
    id: "tx-10",
    icon: Music,
    name: "Spotify",
    date: "Feb 18, 2026",
    amount: "-$9.99",
    category: "Other",
    isPositive: false,
  },
  {
    id: "tx-11",
    icon: Car,
    name: "Gas Station",
    date: "Feb 17, 2026",
    amount: "-$52.30",
    category: "Transport",
    isPositive: false,
  },
  {
    id: "tx-12",
    icon: Banknote,
    name: "Freelance Payment",
    date: "Feb 16, 2026",
    amount: "+$850.00",
    category: "Income",
    isPositive: true,
    iconBgColor: { light: "#D4EDBA", dark: "#1A2E12" },
  },
];
