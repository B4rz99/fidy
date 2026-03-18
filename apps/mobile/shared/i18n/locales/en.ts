const en = {
  // Common
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    dismiss: "Dismiss",
    category: "Category",
    description: "Description",
    amount: "Amount",
    date: "Date",
    type: "Type",
    status: "Status",
    active: "Active",
    deleted: "Deleted",
    unknown: "Unknown",
    transaction: "Transaction",
    none: "(none)",
    name: "Name",
    other: "Other",
  },

  // Tab navigation
  tabs: {
    home: "Home",
    ai: "AI",
    add: "Add",
    calendar: "Calendar",
    settings: "Settings",
    budgets: "Budgets",
    menu: "Menu",
  },

  // Transactions
  transactions: {
    expense: "Expense",
    income: "Income",
    saveTransaction: "Save Transaction",
    descriptionOptional: "Description (optional)",
    noTransactionsYet: "No transactions yet",
    noTransactionsHint: "Connect an email account or add transactions manually to get started",
  },

  // Bills / Calendar
  bills: {
    addBill: "Add Bill",
    editBill: "Edit Bill",
    frequency: "Frequency",
    startDate: "Start Date",
    saveChanges: "Save Changes",
    add: "Add",
    deleteBill: "Delete Bill",
    deleteBillConfirm: 'Are you sure you want to delete "%{billName}"?',
    noBillsOnDay: "No bills on this day",
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly",
    yearly: "Yearly",
  },

  // Calendar
  calendar: {
    title: "Calendar",
    weekdays: {
      mon: "M",
      tue: "T",
      wed: "W",
      thu: "T",
      fri: "F",
      sat: "S",
      sun: "S",
    },
  },

  // Budgets
  budgets: {
    title: "Budgets",
    empty: {
      title: "No budgets yet",
      subtitle: "Set spending limits and track your money",
      autoSetup: "Auto-setup from last month",
      createManually: "Create manually",
    },
    create: {
      title: "Create Budget",
      selectCategory: "Select a category",
      enterAmount: "Monthly budget amount",
      lastMonthHint: "You spent %{amount} on %{category} last month",
    },
    edit: {
      title: "Edit Budget",
    },
    card: {
      remaining: "%{amount} remaining",
      over: "%{amount} over budget",
      used: "%{percent}% used",
    },
    summary: {
      totalBudget: "Total Budget",
      used: "%{percent}% used",
    },
    alerts: {
      nearLimit: "%{category} is at %{percent}% of budget",
      overBudget: "%{category} is over budget at %{percent}%",
    },
    autoSuggest: {
      title: "Auto-setup Budgets",
      subtitle: "Based on last month's spending",
      skipAll: "Skip",
      acceptSelected: "Accept selected",
    },
    upcomingBills: {
      title: "Upcoming Bills",
      seeAll: "See all",
      noBills: "No upcoming bills",
    },
    copyForward: {
      prompt: "Copy budgets from last month?",
      accept: "Copy budgets",
      skip: "Start fresh",
    },
  },

  // Date labels
  dates: {
    today: "Today",
    yesterday: "Yesterday",
    todayWithDate: "Today, %{date}",
  },

  // Login
  login: {
    tagline: "your finances, simplified.",
    continueWithGoogle: "Continue with Google",
    continueWithMicrosoft: "Continue with Microsoft",
    legalText: "By continuing, you agree to our Terms of Service\nand Privacy Policy.",
  },

  // Connected Accounts
  connectedAccounts: {
    title: "Connected Accounts",
    subtitle:
      "Manage your connected accounts and capture sources for automatic transaction tracking.",
    connected: "Connected",
    notConnected: "Not connected",
    connectDescription: "Connect your %{provider} account to capture bank emails.",
    connectProvider: "Connect %{provider}",
    disconnect: "Disconnect",
    lastSynced: "Last synced: %{time}",
    notSyncedYet: "Not synced yet",
  },

  // Failed Emails
  failedEmails: {
    title: "Unprocessed Emails",
    subtitle:
      "These bank emails couldn't be processed automatically. You can add them as transactions manually.",
    empty: "No unprocessed emails",
    addManually: "Add manually",
    parseFailedReason: "Could not extract transaction data",
    parseErrorReason: "Error while processing email",
  },

  // Email Capture
  emailCapture: {
    autoCapture: "Auto-capture transactions",
    connectDescription: "Connect your email to automatically capture bank transactions.",
    unprocessedEmails: {
      one: "%{count} unprocessed email",
      other: "%{count} unprocessed emails",
    },
    tapToReview: "Tap to review and add manually",
  },

  // Progress
  progress: {
    fetchingTitle: "Fetching your emails...",
    fetchingSubtitle: "Reading the last 30 days",
    scanningTitle: "Scanning emails...",
    processingSubtitle: "%{completed} of %{total}",
    completeTitle: "Import complete!",
    completeSubtitle: "Found %{saved} transactions from %{total} emails",
    failedSuffix: " (%{failed} couldn't be read)",
    transactionsFound: {
      one: "%{count} transaction found",
      other: "%{count} transactions found",
    },
  },

  // Needs Review
  needsReview: {
    title: "Review Transactions",
    allCaughtUp: "All caught up!",
    noReviewNeeded: "No transactions need review right now.",
    count: {
      one: "%{count} transaction needs review",
      other: "%{count} transactions need review",
    },
    lowConfidence: "Low confidence parses",
    lowConfidenceHint:
      "These were parsed with low confidence. Please confirm or correct the category.",
    bankNotification: "Bank notification",
  },

  // Sync Conflicts
  syncConflicts: {
    title: "Sync Conflicts",
    allResolved: "All resolved!",
    noConflicts: "No sync conflicts right now.",
    count: {
      one: "%{count} sync conflict needs review",
      other: "%{count} sync conflicts need review",
    },
    changesFromDevice: "Changes from another device",
    yourVersion: "Your version",
    syncedVersion: "Synced version",
    keepMine: "Keep mine",
    acceptSynced: "Accept synced",
  },

  // Chart Section
  chart: {
    dailySpending: "Daily Spending",
    last30Days: "Last 30 days",
    avgPerDay: "Avg/day",
    thisMonthTotal: "This month total",
    spent: "spent",
  },

  // AI Chat
  aiChat: {
    title: "AI Chat",
    fidyAi: "Fidy AI",
    memories: "Memories",
    noConversations: "No conversations yet",
    tapToStart: "Tap + to start a new chat",
    placeholder: "Ask about your finances...",
    cleanupMessage: {
      one: "%{count} expired conversation was removed",
      other: "%{count} expired conversations were removed",
    },
    askAnything: "Ask me anything about your finances",
    suggestions: {
      monthSpending: "How much did I spend this month?",
      biggestExpense: "What's my biggest expense?",
      compareMonths: "Compare my spending to last month",
      addExpense: "Add a food expense for today",
    },
    memoriesDescription:
      "Things Fidy AI remembers about you. Delete any memory you'd like it to forget.",
    noMemories: "No memories yet",
    noMemoriesHint: "Fidy AI will learn about you as you chat",
    memoryCategories: {
      habit: "Habit",
      preference: "Preference",
      situation: "Situation",
      goal: "Goal",
    },
  },

  // Settings
  settings: {
    title: "Settings",
    accountSection: "ACCOUNT",
    preferencesSection: "PREFERENCES",
    connectionsSection: "CONNECTIONS",
    appSection: "APP",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    languageEnglish: "English",
    languageSpanish: "Español",
    connectedEmails: "Connected Emails",
    connectedEmailsCount: {
      one: "%{count} account",
      other: "%{count} accounts",
    },
    notifications: "Notifications",
    helpSupport: "Help & Support",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    version: "Version",
    deleteAccount: "Delete Account",
    deleteAccountTitle: "Delete Account",
    deleteAccountWarning:
      "This will permanently delete your account and all your data. This action cannot be undone.",
    deleteAccountUnsyncedWarning: {
      one: "You have %{count} unsynced change that will be lost.",
      other: "You have %{count} unsynced changes that will be lost.",
    },
    deleteAccountConfirm: "Delete My Account",
    profileTitle: "Profile",
    logout: "Log Out",
    logoutConfirmTitle: "Log Out",
    logoutConfirmMessage: "Are you sure you want to log out?",
  },

  // Notification Capture
  notificationCapture: {
    title: "Notification Capture",
    description: "Automatically capture transactions from your bank app notifications.",
    listening: "Listening",
    permissionRequired: "Permission required",
    grantAccess: "Grant Access",
  },

  // Apple Pay / SMS
  applePay: {
    title: "Apple Pay",
    connected: "Connected",
    notSetUp: "Not set up",
    description: "Automatically capture transactions when you pay with Apple Pay.",
    steps: [
      "Open the Shortcuts app on your iPhone",
      "Tap Automation > + > Transaction",
      "Select your card and tap Next",
      "Search 'Fidy' > 'Record transaction' > Enable 'Run immediately'",
    ],
  },

  smsDetection: {
    title: "Bank SMS Detection",
    description: "Detects when you receive bank SMS to remind you to record the transaction.",
    steps: [
      "Open the Shortcuts app on your iPhone",
      "Tap Automation > + > Message",
      "Select your bank numbers and tap Next",
      "Search 'Fidy' > 'Detect bank SMS' > Enable 'Run immediately'",
    ],
  },

  // Search
  search: {
    title: "Search",
    placeholder: "Search transactions...",
    category: "Category",
    dateRange: "Date range",
    amount: "Amount",
    type: "Type",
    clearAll: "Clear all",
    noResults: "No transactions match",
    clearFilters: "Clear filters",
    resultsSummary: "%{count} transactions · %{total} total",
    today: "Today",
    thisWeek: "This week",
    thisMonth: "This month",
    lastMonth: "Last month",
    customRange: "Custom range",
    from: "From",
    to: "To",
    min: "Min",
    max: "Max",
    allTypes: "All",
  },

  // Detected Transactions Banner
  detectedTransactions: {
    count: {
      one: "%{count} bank transaction today",
      other: "%{count} bank transactions today",
    },
    subtitle: "SMS detected - tap to review",
  },
} as const;

export default en;
