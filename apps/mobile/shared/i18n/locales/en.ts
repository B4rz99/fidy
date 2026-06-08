const en = {
  // Common
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    dismiss: "Dismiss",
    back: "Back",
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
    account: "Account",
    none: "(none)",
    name: "Name",
    other: "Other",
    clear: "Clear",
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
    average: "Average",
    categoryBars: "Spending by category",
    dailyPace: "Daily",
    dailyPaceGuidance: "Spend up to %{amount} per day to stay within budget.",
    monthlySpend: "Monthly spend",
    noBudgetGuidance:
      "Set a monthly budget to see your daily spending limit. Current average: %{amount}.",
    spendingSummary: "Monthly spending summary",
    spentThisMonth: "Spent this month",
  },

  accountSuggestions: {
    prompt: {
      count: {
        one: "%{count} account suggestion ready",
        other: "%{count} account suggestions ready",
      },
      subtitle: "Review them now to improve where recent captures land.",
    },
    review: {
      title: "Improve accuracy",
      subtitle:
        "Create or link the strongest account suggestions now, or skip them until you need them.",
      emptyTitle: "No account suggestions right now",
      emptySubtitle:
        "When repeated capture evidence points to a missing account, it will show up here.",
      dismissFailed: "Could not dismiss suggestion",
    },
    onboarding: {
      eyebrow: "OPTIONAL ACCOUNT REVIEW",
      title: "We found strong account suggestions from your recent captures.",
      subtitle: "Review the strongest matches now, or continue and finish setup first.",
      note: "Highest-confidence matches are shown first so onboarding stays fast.",
      continue: "Continue to budgets",
    },
    card: {
      create: "Create",
      linkExisting: "Link existing",
      skipForNow: "Skip",
      confidenceHigh: "HIGH",
      confidenceMedium: "MED",
      reasonLast4: "We found this card ending in %{value}.",
      reasonAlias: "%{source} and %{value} appeared together across %{count} captures.",
      reasonCardHint: "%{source} card hints for %{value} appeared across %{count} captures.",
      reasonCardProduct:
        "We often saw %{source} %{evidence}. Confirm if this is one of your cards.",
      reasonAccountType: "We often saw %{source} %{evidence}. Confirm before creating an account.",
    },
    create: {
      title: "Create account",
      subtitle: "Create a financial account from this suggestion. You can edit the details later.",
      nameLabel: "Account name",
      kindLabel: "Account kind",
      identifierLabel: "Identifier evidence",
      save: "Create account",
      saveFailed: "Could not create account",
    },
    link: {
      title: "Link existing",
      subtitle:
        "We ranked the strongest matches first so you can confirm the right account quickly.",
      likelyMatches: "Likely matches",
      allAccounts: "All accounts",
      linkFailed: "Could not link account",
    },
  },

  // Transactions
  transactions: {
    expense: "Expense",
    income: "Income",
    saved: "Transaction saved",
    saveTransaction: "Save transaction",
    descriptionOptional: "Description (optional)",
    noTransactionsYet: "No transactions yet",
    noTransactionsHint: "Connect an email account or add your first transaction.",
    deleteConfirmTitle: "Delete transaction?",
    deleteConfirmMessage: "It will no longer count in your spending, budgets, or reports.",
    keepTransaction: "Keep transaction",
    deleteTransaction: "Delete transaction",
    editTransaction: "Edit transaction",
    convertToTransfer: "Convert to transfer",
    updateFailed: "Transaction was not updated. Check the details and try again.",
    deleteFailed: "Transaction was not deleted. Check your connection and try again.",
  },

  transfers: {
    title: "New transfer",
    reclassifyTitle: "Convert to transfer",
    subtitle: "Transfers move money between tracked accounts, cash, or another untracked account.",
    reclassifySubtitle:
      "Replace this captured transaction with the transfer it actually represents, without losing the original evidence.",
    outsideSubtitle:
      "Use Outside Fidy when the other side is cash or another source you do not track.",
    conflictSubtitle:
      "Transfers need two different sides. If money starts and ends in the same account, nothing actually moved.",
    amountLabel: "Transfer amount",
    fromLabel: "From",
    toLabel: "To",
    dateLabel: "Transfer date",
    chooseSide: "Choose side",
    chooseSideHint: "Choose an account, cash, or another untracked account",
    chooseDifferentSide: "Choose different side",
    saved: "Transfer saved",
    save: "Record transfer",
    outsideFidy: "Outside Fidy",
    outsideFidyDescription: "Cash or another untracked account",
    outsideHint:
      "Need cash or another untracked account? Choose it explicitly instead of saving a fake expense.",
    reclassifyHint:
      "Saving will supersede the original transaction, keep the capture evidence attached, and stop the old record from counting as spending.",
    outsideSelectedHint:
      "Outside Fidy keeps this transfer explicit without creating a fake account or expense.",
    conflictHint:
      "Choose two different sides. A transfer cannot start and end in the same financial account.",
    pickerTitle: "Choose transfer side",
    pickerSubtitle:
      "Pick a tracked financial account, or choose Outside Fidy for cash or external funding.",
    a11y: {
      amountField: "Edit transfer amount",
      selectSide: "Select %{side} side",
      changeDate: "Change transfer date",
    },
    errors: {
      amountRequired: "Enter a transfer amount",
      sidesRequired: "Choose both sides before saving",
      trackedAccountRequired: "At least one side must be a tracked account",
      distinctSidesRequired: "Choose two different sides",
      reclassifyFailed: "Could not convert this transaction into a transfer",
      saveFailed: "Transfer was not saved. Check both sides and try again.",
    },
    reclassifySave: "Convert to transfer",
    activity: {
      generic: "Transfer",
      toAccount: "Transfer to %{name}",
      fromAccount: "Transfer from %{name}",
      route: "%{from} -> %{to}",
    },
  },

  financialAccounts: {
    defaultName: "Cash",
    kinds: {
      checking: "Checking",
      savings: "Savings",
      wallet: "Wallet",
      cash: "Cash",
      // biome-ignore lint/style/useNamingConvention: i18n key mirrors FinancialAccountKind
      credit_card: "Credit card",
    },
    labels: {
      default: "Default",
      notDefault: "No",
      noOpeningBalance: "Not set",
      noBillingDay: "Not set",
    },
    list: {
      settingsRow: "Financial accounts",
      title: "Financial accounts",
      subtitle: "Accounts you use for balances, transfers, and manual entry.",
      regularSection: "Cash and bank accounts",
      creditSection: "Credit cards",
      emptyTitle: "No financial accounts yet",
      emptySubtitle: "Add an account when you want balances and transfers outside capture setup.",
      addCta: "Add account",
      addLabel: "Add account",
      billingGap: "Card cycle dates missing",
      identifiersCount: { one: "%{count} identifier", other: "%{count} identifiers" },
    },
    detail: {
      title: "Account details",
      accountSection: "Account details",
      openingBalanceSection: "Opening balance",
      billingProfileTitle: "Billing profile",
      kindLabel: "Account type",
      defaultLabel: "Default account",
      openingBalanceLabel: "Opening balance",
      startingDebtLabel: "Starting debt",
      effectiveDateLabel: "Effective date",
      identifiersTitle: "Identifiers",
      identifiersEmpty: "No identifiers saved yet.",
      manageIdentifiers: "Manage identifiers",
      editCta: "Edit account",
      billingGapTitle: "Card cycle dates missing",
      billingGapBody:
        "Statement-aware card features stay off until you add the statement closing day and payment due day.",
    },
    form: {
      createTitle: "Add account",
      editTitle: "Edit account",
      createSubtitle: "Set up an account you want to track outside the suggestion flow.",
      editSubtitle: "Update this account without going back through onboarding.",
      nameLabel: "Account name",
      namePlaceholder: "e.g. Bancolombia checking",
      kindLabel: "Account type",
      basicInfoSection: "Basic information",
      optionalLabel: "Optional",
      balanceLabel: "Opening balance",
      debtLabel: "Starting debt",
      dateLabel: "Effective date",
      datePlaceholder: "Choose a date",
      dayPlaceholder: "Day",
      billingHint:
        "Optional. Add the statement closing day and payment due day later if you do not have them yet.",
      statementClosingDay: "Statement closing day",
      paymentDueDay: "Payment due day",
      saveCreate: "Create account",
      saveEdit: "Save changes",
      loading: "Loading account...",
      missingTitle: "Account not found",
      missingBody:
        "This account is no longer available. Go back to Financial accounts and try another one.",
      missingCta: "Back to accounts",
      invalidOpeningBalance: "Add both an amount and an effective date, or leave both empty.",
      invalidBillingDay: "Enter a day between 1 and 31.",
      saveFailed: "Account was not saved. Check the details and try again.",
    },
    identifierScreen: {
      title: "Add identifier",
      subtitle: "Save a stable hint you will recognize later for this account.",
      label: "Identifier",
      placeholder: "e.g. Visa gold",
      note: "Keep it short and stable. You can add more hints later.",
      save: "Save identifier",
      saveFailed: "Identifier was not saved. Try again.",
    },
  },

  // Bills / Calendar
  bills: {
    addBill: "Add bill",
    editBill: "Edit bill",
    frequency: "Frequency",
    startDate: "Start date",
    saveChanges: "Save changes",
    add: "Add",
    deleteBill: "Delete bill",
    deleteBillConfirm: 'Delete "%{billName}"? Future reminders for this bill will stop.',
    noBillsOnDay: "No bills on this day",
    placeholder: {
      amount: "50000",
      name: "Netflix",
    },
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly",
    yearly: "Yearly",
  },

  // Calendar
  calendar: {
    title: "Calendar",
    thisMonth: "This month",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    paid: "Paid",
    pending: "Pending",
    pendingPayments: {
      one: "You have 1 payment left to mark.",
      other: "You have %{count} payments left to mark.",
    },
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
      saveFailed: "Category was not saved. Choose a name, icon, and color, then try again.",
    },
  },

  // Budgets
  budgets: {
    title: "Budgets",
    header: {
      previousMonthLabel: "Previous month",
      previousMonthHint: "Shows budgets for the previous month",
      nextMonthLabel: "Next month",
      nextMonthHint: "Shows budgets for the next month",
      addLabel: "Add budget",
      addHint: "Opens the form to create a budget",
    },
    empty: {
      title: "No budgets yet",
      subtitle: "Set spending limits and track your money",
      autoSetup: "Auto-setup from last month",
      createManually: "Create manually",
    },
    create: {
      title: "Create budget",
      selectCategory: "Select a category",
      enterAmount: "Monthly budget amount",
      lastMonthHint: "You spent %{amount} on %{category} last month",
    },
    edit: {
      title: "Edit budget",
    },
    card: {
      remaining: "%{amount} left",
      over: "%{amount} over budget",
      used: "%{percent}% used",
      status: {
        onTrack: "On track",
        nearLimit: "Close to limit",
        over: "Over limit",
      },
    },
    summary: {
      totalBudget: "Total budget",
      used: "%{percent}% used",
      remaining: "You have %{amount} left to close the month.",
      over: "You are %{amount} over this month.",
    },
    alerts: {
      nearLimitTitle: "Budget warning",
      overBudgetTitle: "Budget exceeded!",
      nearLimit: "%{category} is at %{percent}% of budget",
      overBudget: "%{category} is over budget at %{percent}%",
    },
    autoSuggest: {
      title: "Auto-setup budgets",
      subtitle: "Based on last month's spending",
      skipAll: "Skip",
      acceptSelected: "Accept selected",
      noSuggestions: "No spending data from last month",
    },
    upcomingBills: {
      title: "Upcoming bills",
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
      title: "Create goal",
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
      title: "Edit goal",
      saveChanges: "Save changes",
      deleteGoal: "Delete goal",
      deleteConfirmTitle: 'Delete "%{goalName}"?',
      deleteConfirmMessage: "This will remove the goal from your active goals.",
      keepGoal: "Keep goal",
    },
    card: {
      installments: "%{current}/%{total}",
      almostThere: "Almost there!",
      completed: "Completed!",
      amountOfTarget: "%{current} of %{target}",
      remaining: "%{amount} left",
      debt: "Debt",
      detail: "Detail",
      addPayment: "Add payment",
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
      addPayment: "Add payment",
      noContributions: "No contributions yet",
      contributionNote: "Note: %{note}",
      recommendation: "Fidy's recommendation",
      recommendationText: "Save %{amount}/month to reach your goal by %{date}.",
      recommendationTextNoDate: "Save %{amount}/month to reach your goal.",
      askFidy: "Ask Fidy for more ideas",
      manualPayment: "Manual payment",
    },
    payment: {
      title: "Add payment",
      addPaymentCta: "+ Add payment",
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
    continueInLocalQaMode: "Continue in local QA mode",
    legalText: "By continuing, you agree to our Terms of Service\nand Privacy Policy.",
  },

  // Connected Accounts
  connectedAccounts: {
    title: "Connected accounts",
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

  // Email Capture
  emailCapture: {
    autoCapture: "Auto-capture transactions",
    connectDescription: "Connect your email to automatically capture bank transactions.",
    connectProviders: {
      gmail: "Gmail",
      outlook: "Outlook",
    },
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

  financialMeaningReview: {
    bannerTitle: {
      one: "%{count} capture needs meaning review",
      other: "%{count} captures need meaning review",
    },
    bannerSubtitle: "We still need to confirm whether these captures are spending or transfers.",
    queueTitle: "Financial Meaning",
    queueCount: {
      one: "%{count} capture needs financial meaning",
      other: "%{count} captures need financial meaning",
    },
    queueSubtitle:
      "Confirm what each capture actually represents before account ownership continues.",
    emptyTitle: "No meaning reviews left",
    emptySubtitle: "Everything in this queue already has a confirmed financial meaning.",
    reviewTitle: "Review Meaning",
    reviewPill: "Meaning still looks ambiguous",
    reviewSubtitle: "Confirm whether this capture is real spending or should become a transfer.",
    reviewMeaning: "Review meaning",
    dismiss: "Dismiss",
    skip: "Skip",
    itsTransaction: "It's a transaction",
    transfer: "Transfer",
    whatWeDetected: "Current interpretation",
    transactionDetected: "Captured as spending",
    transferHint:
      "If this was money moving between accounts, convert it instead of keeping it as spending.",
    transferExplanation:
      "Converting to a transfer supersedes the original transaction and keeps the source evidence attached to the corrected record.",
    providers: {
      gmail: "Gmail capture",
      outlook: "Outlook capture",
    },
    errors: {
      dismissFailed: "Couldn't dismiss this capture.",
      resolveFailed: "Couldn't resolve this capture.",
    },
  },

  attributionReview: {
    bannerTitle: {
      one: "%{count} owner review is ready",
      other: "%{count} owner reviews are ready",
    },
    bannerSubtitle: "These captures still need their real financial account confirmed.",
    queueTitle: "Account Attribution",
    queueCount: {
      one: "%{count} capture needs owner review",
      other: "%{count} captures need owner review",
    },
    queueSubtitle:
      "These transactions count overall, but they stay provisional until you confirm the real account.",
    emptyTitle: "No owner reviews left",
    emptySubtitle: "Every suggestion-backed provisional capture has been confirmed or deferred.",
    provisionalLabel: "Provisional owner",
    currentOwner: "Current fallback",
    suggestedOwner: "Suggested owner",
    confirmOwner: "Confirm owner",
    chooseAnother: "Choose another",
    skip: "Skip",
    reviewTitle: "Review Owner",
    reviewPill: "Owner still looks provisional",
    reviewSubtitle:
      "One confirmation teaches Fidy which account should own similar captures next time.",
    confirmAccount: "Confirm account",
    createNew: "Create new",
    fallbackOwner: "Fallback account",
    suggestedByEvidence: "Suggested from repeated capture evidence",
    balanceHint:
      "Until you confirm the owner, this transaction stays out of account-specific balances even though it still counts overall.",
    errors: {
      confirmFailed: "Couldn't confirm the account owner.",
    },
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

  dateGroups: {
    today: "Today",
    yesterday: "Yesterday",
  },

  // AI Chat
  aiChat: {
    title: "AI chat",
    conversationsSubtitle: "Resume a conversation or start a new financial question.",
    fidyAi: "Fidy AI",
    newChat: "New chat",
    noConversations: "No conversations yet",
    tapToStart: "Tap + to start a new chat",
    placeholder: "Ask about your finances...",
    scrollToBottom: "Scroll to bottom",
    thinking: "Fidy is thinking",
    concierge: {
      label: "Financial assistant",
      title: "Ask without opening spreadsheets.",
      subtitle:
        "Fidy can explain your month, find unusual spending, or help you record transactions.",
    },
    cleanupMessage: {
      one: "%{count} expired conversation was removed",
      other: "%{count} expired conversations were removed",
    },
    askAnything: "Ask me anything about your finances",
    suggestions: {
      monthSpending: "How much did I spend this month?",
      biggestExpense: "What was my biggest expense?",
      compareMonths: "Compare this month to the previous one",
      addExpense: "Record a lunch expense",
    },
    actions: {
      deleteTransaction: "Delete transaction",
    },
    status: {
      added: "Added",
      deleted: "Deleted",
      dismissed: "Dismissed",
    },
  },

  // Settings
  settings: {
    title: "Settings",
    openSettings: "Open settings",
    accountSection: "ACCOUNT",
    preferencesSection: "PREFERENCES",
    connectionsSection: "CONNECTIONS",
    privateBackupSection: "PRIVATE BACKUP",
    privacySection: "PRIVACY",
    appSection: "APP",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    languageEnglish: "English",
    languageSpanish: "Español",
    connectedEmails: "Connected emails",
    connectedEmailsCount: {
      one: "%{count} account",
      other: "%{count} accounts",
    },
    notifications: "Notifications",
    privateBackup: "Private backup",
    parseImprovementSharing: "Improve capture parsing",
    parseImprovementSharingSubtitle:
      "Share redacted email and notification formats when parsing struggles. Amounts, merchants, dates, names, and cards are removed first.",
    privateBackupStatus: {
      notSetUp: "Not set up",
      recoveryKeyNotConfirmed: "Recovery Key not confirmed",
      ready: "Ready",
      backupFailed: "Backup failed",
    },
    on: "On",
    off: "Off",
    helpSupport: "Help & support",
    privacyPolicy: "Privacy policy",
    termsOfService: "Terms of service",
    designSystem: "Design system",
    designSystemSubtitle: "Preview shared UI components",
    version: "Version",
    deleteAccount: "Delete account",
    deleteAccountTitle: "Delete account",
    deleteAccountWarning:
      "This will permanently delete your account, encrypted backups, and all remote data. Old encrypted backups cannot be recovered after deletion.",
    deleteAccountUnsyncedWarning: {
      one: "You have %{count} unsynced change that will be lost.",
      other: "You have %{count} unsynced changes that will be lost.",
    },
    deleteAccountConfirm: "Delete my account",
    profileTitle: "Profile",
    logout: "Log out",
    logoutConfirmTitle: "Log out?",
    logoutConfirmMessage: "You will need to sign in again to sync or restore backups.",
    staySignedIn: "Stay signed in",
    localQaTitle: "Local QA",
    localQaDescription: "Reset or switch local-only QA scenarios without touching a real account.",
    localQaReset: "Reset current scenario",
    localQaOpenTools: "Open QA tools",
    localQaExit: "Exit local QA",
  },

  designSystem: {
    title: "Design system",
    heading: "Fidy UI catalog",
    subtitle: "A local preview for shared mobile components, tokens, and interaction states.",
    typographySection: "TYPOGRAPHY",
    colorsSection: "COLORS",
    buttonsSection: "BUTTONS",
    cardsSection: "CARDS",
    rowsSection: "ROWS",
    titleSample: "Monthly budget",
    bodySample: "Use this scale for body copy, hints, and list metadata.",
    captionSample: "CAPTION / SUPPORTING LABEL",
    primaryButton: "Primary action",
    secondaryButton: "Secondary action",
    dangerButton: "Danger action",
    ghostButton: "Ghost action",
    cardTitle: "Cash wallet",
    cardSubtitle: "Default spending account",
    calloutTitle: "Budget pacing",
    rowTitle: "Notification row",
    rowWithSubtitle: "Insight row",
    rowSubtitle: "Secondary text stays short and factual.",
  },

  privateBackup: {
    title: "Private backup",
    status: {
      notSetUp: "Private backup off",
      recoveryKeyNotConfirmed: "Save Recovery Key",
      ready: "Recovery Key saved",
      backupFailed: "Backup needs retry",
    },
    notSetupTitle: "Save a private backup",
    notSetupBody:
      "Fidy can save a backup that only your Recovery Key or a trusted device can unlock.",
    confirmTitle: "Save your Recovery Key now",
    confirmBody: "Keep this key in a password manager. Fidy cannot recreate it later.",
    readyTitle: "Your backup is healthy",
    readyBody: "Fidy is saving encrypted backups for this account.",
    failedTitle: "Backup upload failed",
    failedBody: "Your current phone still has your data. Retry when your connection is steady.",
    recoveryKeyLabel: "Recovery Key",
    recoveryKeyHelper:
      "Save it to a password manager, iCloud Passwords, or Bitwarden. Copy and paste should be the default path.",
    confirmPlaceholder: "Paste your Recovery Key",
    saveKey: "Save Recovery Key",
    savingBackup: "Saving backup...",
    finishLater: "Finish later",
    setUp: "Set up private backup",
    retryBackup: "Retry backup",
    viewKey: "View key",
    rotateKey: "Rotate key",
    encryptedBackupTitle: "Encrypted backup",
    encryptedBackupBody: "Last backup %{backupDate}",
    recoveryKeySavedTitle: "Recovery Key saved",
    recoveryKeySavedBody: "Stored in your password manager",
    newPhoneTitle: "Recovery Key",
    newPhoneBody: "Keep this key available outside Fidy",
    privacyNote:
      "Login finds the backup account. Only the Recovery Key or a trusted device can unlock the encrypted backup.",
    keyUnavailable: "This Recovery Key is no longer available in the app.",
    confirmMismatchTitle: "That key does not match",
    confirmMismatchBody: "Paste the Recovery Key exactly as shown before marking backup ready.",
    uploadFailedTitle: "Backup was not saved",
    uploadFailedBody: "Check your connection and try again. Fidy will not mark backup ready yet.",
    signInRequired: "Sign in again so Fidy can save this private backup to your account.",
    checklist: {
      passwordManager: "Save the key in a password manager you already trust.",
      newDevice: "Paste it on a new device when Fidy finds your encrypted backup.",
      lostKey: "If you lose both this key and a trusted device, the old ledger stays locked.",
    },
  },

  parseImprovementPrompt: {
    title: "Help improve parsing?",
    body: "We can share this redacted format to improve future parsing:\n\n%{template}\n\nAmounts, merchants, dates, names, and cards are removed first.",
    share: "Share redacted format",
    notNow: "Not now",
  },

  errorFallback: {
    title: "Fidy could not load this screen",
    body: "Close and reopen the app. If it keeps happening, your local data is still on this device.",
    restart: "Restart app",
  },

  qaTools: {
    title: "QA Tools",
    subtitle: "Seed deterministic local-only scenarios and jump straight to the screen you want.",
    unavailable: "Local QA tools are only available in development builds.",
    currentProfile: "Current profile: %{profile}",
    noActiveProfile: "No local QA profile is active.",
    preparing: "Preparing local QA scenario...",
    startFailed: "Could not start the selected QA scenario.",
    scenariosTitle: "Scenarios",
    flagsTitle: "Feature flags",
    actionsTitle: "Reset tools",
    openTitle: "Open screen",
    openWithCurrentProfile: "Open current profile entry point",
    logsTitle: "Log inspector",
    logsEmpty: "No QA logs captured yet.",
    networkTitle: "Network inspector",
    networkEmpty: "No network requests captured yet.",
    flagOn: "ON",
    flagOff: "OFF",
    banner: "QA profile: %{profile} · offline: %{offline}",
    bannerOfflineOn: "simulated",
    bannerOfflineOff: "live",
    profiles: {
      default: {
        title: "Default",
        description: "One default cash account and onboarding complete.",
      },
      "home-activity": {
        title: "Home activity",
        description: "Recent expenses and one transfer for dashboard visual QA.",
      },
      empty: {
        title: "Empty",
        description: "No financial data and onboarding incomplete.",
      },
      "two-accounts": {
        title: "Two accounts",
        description: "Cash and Bancolombia with no seeded activity.",
      },
      "transfer-ready": {
        title: "Transfer ready",
        description: "Two tracked accounts plus seeded transactions and one transfer.",
      },
      "transfer-conflict": {
        title: "Transfer conflict",
        description: "Two tracked accounts with a prefilled same-account transfer conflict.",
      },
    },
    flags: {
      networkInspectorEnabled: {
        title: "Network inspector",
        description: "Capture recent fetch requests with status and timing data.",
      },
      logInspectorEnabled: {
        title: "Log inspector",
        description: "Capture QA-scoped app events from auth, seed, and harness boundaries.",
      },
      simulateOffline: {
        title: "Simulate offline",
        description: "Force fetch requests to fail so you can test offline and error states.",
      },
      showQaBanner: {
        title: "Show QA banner",
        description: "Render a small on-device banner with the active QA profile and network mode.",
      },
    },
    actions: {
      resetCurrentScenario: "Reset current scenario",
      resetFlags: "Reset feature flags",
      clearLogs: "Clear QA logs",
      clearNetwork: "Clear network events",
      exitLocalQa: "Exit local QA",
    },
    open: {
      home: "Home",
      addChooser: "Add chooser",
      onboarding: "Onboarding",
      addTransaction: "Add transaction",
      addTransfer: "Add transfer",
      transferConflict: "Transfer conflict preset",
      financialAccounts: "Financial accounts",
      profile: "Profile",
      qaTools: "QA tools",
    },
  },

  // Notification Capture
  notificationCapture: {
    title: "Notification capture",
    description: "Automatically capture transactions from your bank app notifications.",
    listening: "Listening",
    permissionRequired: "Permission required",
    grantAccess: "Grant access",
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
    resultTotal: "Result total",
    movements: "Movements",
    today: "Today",
    thisWeek: "Week",
    thisMonth: "Month",
    lastMonth: "Last month",
    customRange: "Custom range",
    chooseDate: "Choose",
    from: "From",
    to: "To",
    min: "Min",
    max: "Max",
    allTypes: "All",
    transfers: "Transfers",
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
      getStarted: "Get started",
      alreadyHaveAccount: "I already have an account",
    },
    connectEmail: {
      title: "Connect your email accounts",
      description:
        "Connect every inbox where you receive bank or card emails. You can sync after one account or add another first.",
      connectGmail: "Connect Gmail",
      connectOutlook: "Connect Outlook",
      gmailConnected: "Gmail connected",
      outlookConnected: "Outlook connected",
      syncConnectedEmails: "Sync connected emails",
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
      backgroundHelperText: "You can continue. We'll keep importing the rest in the background.",
      continue: "Continue",
    },
    budgetSetup: {
      title: "Set your first budgets",
      subtitle: "Based on your recent spending",
      perMonth: "/month",
      basedOnSpending: "Based on last month's spending",
      saveBudgets: "Save budgets",
      skipForNow: "Skip for now",
      noSuggestions: "No spending data yet — you can set budgets later from the Budgets tab.",
    },
    complete: {
      title: "You're all set!",
      stats: "We found %{transactionCount} transactions and set up %{budgetCount} budgets for you.",
      goToDashboard: "Go to dashboard",
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
    },

    // Pre-permission screen
    enableNotifications: {
      title: "Stay on top of your finances",
      description:
        "Fidy can alert you when you're approaching your budget limit and celebrate your goal milestones.",
      enable: "Enable notifications",
      notNow: "Not now",
    },
  },

  // Analytics
  analytics: {
    title: "Analytics",
    incomeLabel: "Income",
    expensesLabel: "Expenses",
    netLabel: "Net",
    netPrefix: "Net: ",
    spendingByCategory: "Spending by Category",
    vsPreviousPeriodLabel: "Vs. previous period",
    periodDeltaSpentMore: "You spent %{amount} more than the previous period.",
    periodDeltaSpentLess: "You spent %{amount} less than the previous period.",
    periodDeltaSpentSame: "You spent the same as the previous period.",
    whatChanged: "What changed",
    selectedCategoryAmount: "%{category}: %{amount}",
    categoryBarA11y: "%{category}, %{amount}",
    categoryBarSelectedA11y: "%{category}, %{amount}, selected",
    period: {
      week: "W",
      month: "M",
      quarter: "Q",
      year: "Y",
    },
    periodAccessibility: {
      week: "Week",
      month: "Month",
      quarter: "Quarter",
      year: "Year",
    },
    vsPreviousPeriod: {
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      W: "vs previous 7 days",
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      M: "vs previous 30 days",
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      Q: "vs previous 90 days",
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      Y: "vs previous 365 days",
    },
    totalSpending: "Total spending",
    noData: "Not enough data for this period",
  },
} as const;

export default en;
