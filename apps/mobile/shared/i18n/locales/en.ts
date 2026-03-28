const en = {
  // Common
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    dismiss: "Dismiss",
    close: "Close",
    edit: "Edit",
    category: "Category",
    description: "Description",
    amount: "Amount",
    date: "Date",
    type: "Type",
    status: "Status",
    active: "Active",
    deleted: "Deleted",
    unknown: "Unknown",
    addTransaction: "Add transaction",
    transaction: "Transaction",
    none: "(none)",
    name: "Name",
    other: "Other",
    clearAll: "Clear all",
  },

  // Tab navigation
  tabs: {
    home: "Home",
    ai: "AI",
    add: "Add",
    calendar: "Calendar",
    settings: "Settings",
    budgets: "Budgets",
    finance: "Finance",
    menu: "Menu",
  },

  // Dashboard
  dashboard: {
    spentThisMonth: "Spent this month",
  },

  // Transactions
  transactions: {
    expense: "Expense",
    income: "Income",
    saveTransaction: "Save Transaction",
    descriptionOptional: "Description (optional)",
    noTransactionsYet: "No transactions yet",
    noTransactionsHint: "Connect an email account or add transactions manually to get started",
    deleteConfirmTitle: "Delete Transaction",
    deleteConfirmMessage: "Are you sure you want to delete this transaction?",
    editTransaction: "Edit Transaction",
    deleteTransaction: "Delete",
    updateFailed: "Could not update transaction",
    deleteFailed: "Could not delete transaction",
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

  // Categories
  categories: {
    title: "Categories",
    settingsRow: "Categories",
    builtInSection: "DEFAULT",
    customSection: "CUSTOM",
    addCategory: "Add category",
    noCustomCategories: "No custom categories yet",
    create: {
      title: "New category",
      nameLabel: "Category name",
      namePlaceholder: "e.g. Pets",
      iconLabel: "Choose an icon",
      colorLabel: "Choose a color",
      submit: "Create category",
    },
    errors: {
      nameTooShort: "Name must be at least 2 characters",
      nameTooLong: "Name must be under 32 characters",
      iconRequired: "Please select an icon",
      colorRequired: "Please select a color",
      saveFailed: "Could not save category",
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
      nearLimitTitle: "Budget warning",
      overBudgetTitle: "Budget exceeded!",
      nearLimit: "%{category} is at %{percent}% of budget",
      overBudget: "%{category} is over budget at %{percent}%",
    },
    autoSuggest: {
      title: "Auto-setup Budgets",
      subtitle: "Based on last month's spending",
      skipAll: "Skip",
      acceptSelected: "Accept selected",
      noSuggestions: "No spending data from last month",
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

  // Goals
  goals: {
    title: "Goals",
    empty: {
      title: "No goals yet",
      subtitle: "Set savings goals and track your progress",
      createGoal: "Create a goal",
    },
    create: {
      title: "Create Goal",
      goalName: "Goal name",
      goalNamePlaceholder: "e.g., Trip to Holland",
      targetAmount: "Target amount",
      targetDate: "Target date (optional)",
      interestRate: "Annual interest rate (%)",
      typeSavings: "Savings",
      typeDebt: "Debt",
      projectionHint: "Based on your income, ~%{months} months",
      noProjectionHint: "Add income transactions for a projection",
    },
    edit: {
      title: "Edit Goal",
      saveChanges: "Save Changes",
      deleteGoal: "Delete Goal",
      deleteConfirmTitle: "Delete Goal",
      deleteConfirmMessage: 'Are you sure you want to delete "%{goalName}"?',
    },
    card: {
      installments: "%{current}/%{total}",
      almostThere: "Almost there!",
      completed: "Completed!",
      addPayment: "+ Add Payment",
      paceAhead: "↑ Ahead %{amount}",
      paceBehind: "↓ Behind %{amount}",
      startSaving: "Start saving",
    },
    detail: {
      contributions: "Contributions",
      aiPlan: "AI Plan",
      estimated: "Estimated: %{date}",
      roughEstimate: "Rough estimate (~%{months} months)",
      setTargetDate: "Set a target date for tracking",
      spendingExceedsIncome: "Spending exceeds income — set a target date to track manually",
      paymentTooLow: "Payment doesn't cover interest",
      progress: "%{percent}% complete",
      remaining: "%{amount} remaining",
      addPayment: "Add Payment",
      noContributions: "No contributions yet",
      contributionNote: "Note: %{note}",
      recommendation: "Fidy's recommendation",
      recommendationText: "Save %{amount}/month to reach your goal by %{date}.",
      recommendationTextNoDate: "Save %{amount}/month to reach your goal.",
      askFidy: "Ask Fidy for more ideas",
      manualPayment: "Manual payment",
    },
    payment: {
      title: "Add Payment",
      addPaymentCta: "+ Add Payment",
      amount: "Amount",
      noteOptional: "Note (optional)",
      notePlaceholder: "e.g., Monthly savings",
      date: "Date",
    },
    milestones: {
      title: "Monthly Milestones",
      target: "Target: %{amount}",
    },
    nudges: {
      reduce: "Reduce %{category} by %{amount}/mo",
      impact: "%{months} month early",
      adjustBudget: "Adjust budget",
    },
    whatIf: {
      title: "What if you saved...",
      perMonth: "%{amount}/month",
      projectedDate: "You'd reach your goal by %{date}",
    },
    smartCard: {
      moreGoals: { one: "%{count} more goal", other: "%{count} more goals" },
    },
    celebration: {
      quarter: "25% there! Keep going!",
      half: "Halfway there! Great progress!",
      threeQuarter: "75% done! Almost there!",
      complete: "Goal reached!",
      descriptionProgress: "You're making great progress on %{goalName}!",
      descriptionComplete: "Congratulations! You've reached your savings goal for %{goalName}.",
      continueButton: "Continue",
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
    syncing: "Syncing...",
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
    moreCategories: "%{count}+ more",
  },

  // AI Chat
  aiChat: {
    title: "AI Chat",
    fidyAi: "Fidy AI",
    memories: "Memory",
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
    on: "On",
    off: "Off",
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

  // Onboarding
  onboarding: {
    welcome: {
      hero: "Your finances, on autopilot",
      subtitle: "Connect your email and let Fidy capture your transactions automatically.",
      getStarted: "Get Started",
      alreadyHaveAccount: "I already have an account",
    },
    connectEmail: {
      title: "Connect your email",
      description: "We'll scan your inbox for bank emails and capture transactions automatically.",
      trustBadge: "Your data stays on your device",
      skipForNow: "Skip for now",
    },
    syncing: {
      processing: "Syncing your transactions...",
      transactionsFound: {
        one: "%{count} transaction found",
        other: "%{count} transactions found",
      },
      recentCaptures: "Recent captures",
      helperText: "This may take a moment",
      continue: "Continue",
    },
    budgetSetup: {
      title: "Set your first budgets",
      subtitle: "Based on your recent spending",
      perMonth: "/month",
      basedOnSpending: "Based on last month's spending",
      saveBudgets: "Save Budgets",
      skipForNow: "Skip for now",
      noSuggestions: "No spending data yet — you can set budgets later from the Budgets tab.",
    },
    complete: {
      title: "You're all set!",
      stats: "We found %{transactionCount} transactions and set up %{budgetCount} budgets for you.",
      goToDashboard: "Go to Dashboard",
    },
  },

  // Guidance
  guidance: {
    budgetAlert80: {
      food: "You have %{remaining} left for %{daysLeft} days. Cooking at home a few times this week could help stretch what's left.",
      transport:
        "You have %{remaining} left for %{daysLeft} days. Using public transit or combining trips where you can might save you a good chunk.",
      entertainment:
        "You have %{remaining} left for %{daysLeft} days. A free evening in or a walk could make that budget go a little further.",
      health:
        "You have %{remaining} left for %{daysLeft} days. If any appointments can wait until next month, that could free up a bit.",
      education:
        "You have %{remaining} left for %{daysLeft} days. Knowing which payments are due soon could help you plan the rest of the month.",
      home: "You have %{remaining} left for %{daysLeft} days. Any home purchases that can wait until next month would help stretch what's left.",
      clothing:
        "You have %{remaining} left for %{daysLeft} days. Any clothing that can wait until next month would help stay within budget.",
      services:
        "You have %{remaining} left for %{daysLeft} days. Checking for any subscriptions you can pause could free up a bit of room.",
      transfer:
        "You have %{remaining} left for %{daysLeft} days. Keeping transfers to what's necessary this week would help stay within budget.",
      other:
        "You have %{remaining} left for %{daysLeft} days. A quick look at recent purchases might show where there's a bit of room to adjust.",
    },
    budgetAlert100: {
      food: "You've gone %{overAmount} over. Cooking at home a few days this week could help bring it back down.",
      transport:
        "You've gone %{overAmount} over. Combining errands and sharing rides where you can will help.",
      entertainment:
        "You've gone %{overAmount} over. Free options — walks, home streaming, parks — can carry you to next month.",
      health:
        "You've gone %{overAmount} over. If any check-ups can wait until next month, that would help balance it out.",
      education:
        "You've gone %{overAmount} over. See if any upcoming payments can shift to next month.",
      home: "You've gone %{overAmount} over. Holding off on home improvements until next month would close the gap.",
      clothing:
        "You've gone %{overAmount} over. Skipping new clothing this month would help recover the difference.",
      services:
        "You've gone %{overAmount} over. Pausing a subscription or two this month could make a real dent.",
      transfer: "You've gone %{overAmount} over. Non-urgent transfers can wait until next month.",
      other:
        "You've gone %{overAmount} over. Taking a close look at recent purchases might reveal some easy wins.",
    },
  },
  notifications: {
    // Titles
    budgetWarning: "%{category} — near your limit",
    budgetExceeded: "%{category} — over budget",
    spendingAnomaly: "%{category} — %{multiplier}x your average",
    budgetPace: "%{category} — on pace to exceed",
    goalMilestone: "%{goalName} — %{percent}% saved!",

    // Messages
    budgetWarningMsg: "%{remaining} left for %{daysLeft} days",
    budgetExceededMsg: "%{overAmount} over — consider pausing until next month",
    spendingAnomalyMsg: "Your weekly spending is higher than usual",
    budgetPaceMsg: "Projected %{projected} vs %{budget} budget",
    goalMilestoneMsg: "You've saved %{percent}% of your goal",

    // Section headers
    weeklyMovesHeader: "YOUR MONEY MOVES · %{weekRange}",
    earlierHeader: "EARLIER",

    // Empty state
    emptyTitle: "Nothing new right now",
    emptySubtitle: "We'll let you know when your budgets or goals need attention",

    // First-week placeholder (G8)
    firstWeekTitle: "Getting to know you",
    firstWeekMessage:
      "Fidy is getting to know your spending. Give me about a week and I'll have your first Money Moves ready.",

    // Screen
    title: "Notifications",

    // Preferences
    preferences: {
      title: "Notification Preferences",
      masterToggle: "All Notifications",
      budgetAlerts: "Budget Alerts",
      budgetAlertsDesc: "When you approach or exceed your budget",
      goalMilestones: "Goal Milestones",
      goalMilestonesDesc: "Updates on your savings and debt goals",
      spendingAnomalies: "Spending Alerts",
      spendingAnomaliesDesc: "Unusual spending patterns detected",
      weeklyDigest: "Weekly Digest",
      weeklyDigestDesc: "Sunday evening summary of your week",
    },

    // Pre-permission screen
    enableNotifications: {
      title: "Stay on Top of Your Finances",
      description:
        "Fidy can alert you when you're approaching your budget limit, celebrate your goal milestones, and send a weekly summary of your finances.",
      enable: "Enable Notifications",
      notNow: "Not Now",
    },
  },

  // Analytics
  analytics: {
    title: "Analytics",
    incomeLabel: "Income",
    expensesLabel: "Expenses",
    netPrefix: "Net: ",
    spendingByCategory: "Spending by Category",
    vsPreviousPeriod: {
      W: "vs previous 7 days",
      M: "vs previous 30 days",
      Q: "vs previous 90 days",
      Y: "vs previous 365 days",
    },
    totalSpending: "Total spending",
    noData: "Not enough data for this period",
  },
} as const;

export default en;
