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
    account: "Account",
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
      reasonLast4: "%{source} ending in %{value} appeared across %{count} captures.",
      reasonAlias: "%{source} and %{value} appeared together across %{count} captures.",
      reasonCardHint: "%{source} card hints for %{value} appeared across %{count} captures.",
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
    saveTransaction: "Save Transaction",
    descriptionOptional: "Description (optional)",
    noTransactionsYet: "No transactions yet",
    noTransactionsHint: "Connect an email account or add transactions manually to get started",
    deleteConfirmTitle: "Delete Transaction",
    deleteConfirmMessage: "Are you sure you want to delete this transaction?",
    editTransaction: "Edit Transaction",
    deleteTransaction: "Delete",
    convertToTransfer: "Convert to transfer",
    updateFailed: "Could not update transaction",
    deleteFailed: "Could not delete transaction",
  },

  addEntry: {
    title: "What do you want to add?",
    subtitle: "Choose the record type first so transfers stay separate from spending and income.",
    transactionTitle: "Transaction",
    transactionBody: "Record spending or income for one financial account",
    transactionBadge: "Expense or income",
    transferTitle: "Transfer",
    transferBody: "Move money between accounts, or use Outside Fidy when one side is not tracked.",
    transferBadge: "No budget impact",
    footnote:
      "Transfers stay out of spending and budget math, so choosing them here prevents double counting later.",
  },

  transfers: {
    title: "New transfer",
    reclassifyTitle: "Convert to transfer",
    subtitle:
      "Transfers move money between accounts or between one tracked account and an explicit outside-fidy side.",
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
    chooseSideHint: "Choose an account or Outside Fidy",
    chooseDifferentSide: "Choose different side",
    save: "Record transfer",
    outsideFidy: "Outside Fidy",
    outsideFidyDescription: "Cash or another untracked side",
    outsideHint:
      "Need cash or another untracked side? Choose it explicitly from the side picker instead of saving a fake expense.",
    reclassifyHint:
      "Saving will supersede the original transaction, keep the capture evidence attached, and stop the old record from counting as spending.",
    outsideSelectedHint:
      "Outside Fidy keeps this transfer explicit without creating a fake account or expense.",
    conflictHint:
      "Choose two different sides. A transfer cannot start and end in the same financial account.",
    pickerTitle: "Choose transfer side",
    pickerSubtitle:
      "Pick a tracked financial account, or explicitly choose an outside-Fidy side for cash or external funding.",
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
      saveFailed: "Could not save transfer",
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
      subtitle:
        "Create and edit the accounts you use for balances, transfers, and manual entry. Connected capture sources stay in Connected Accounts.",
      regularSection: "Cash and bank accounts",
      creditSection: "Credit cards",
      emptyTitle: "No financial accounts yet",
      emptySubtitle: "Add an account when you want balances and transfers outside capture setup.",
      addCta: "Add account",
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
        "Statement-aware card features stay off until you add fecha de corte and fecha limite de pago.",
    },
    form: {
      createTitle: "Add account",
      editTitle: "Edit account",
      createSubtitle: "Set up an account you want to track outside the suggestion flow.",
      editSubtitle: "Update this account without going back through onboarding.",
      nameLabel: "Account name",
      namePlaceholder: "e.g. Bancolombia checking",
      kindLabel: "Account type",
      balanceLabel: "Opening balance",
      debtLabel: "Starting debt",
      dateLabel: "Effective date",
      datePlaceholder: "Choose a date",
      dayPlaceholder: "Day",
      billingHint:
        "Optional. Add fecha de corte and fecha limite de pago later if you do not have them yet.",
      statementClosingDay: "Fecha de corte",
      paymentDueDay: "Fecha limite de pago",
      saveCreate: "Create account",
      saveEdit: "Save changes",
      loading: "Loading account...",
      missingTitle: "Account not found",
      missingBody:
        "This account is no longer available. Go back to Financial accounts and try another one.",
      missingCta: "Back to accounts",
      invalidOpeningBalance: "Add both an amount and an effective date, or leave both empty.",
      invalidBillingDay: "Enter a day between 1 and 31.",
      saveFailed: "Could not save account",
    },
    identifierSheet: {
      title: "Add identifier",
      subtitle: "Save a stable hint you will recognize later for this account.",
      label: "Identifier",
      placeholder: "e.g. Visa gold",
      note: "Keep it short and stable. You can add more hints later.",
      save: "Save identifier",
      saveFailed: "Could not save identifier",
    },
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
    continueInLocalQaMode: "Continue in local QA mode",
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
    privateBackupSection: "PRIVATE BACKUP",
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
    privateBackup: "Private Backup",
    privateBackupStatus: {
      notSetUp: "Not set up",
      recoveryKeyNotConfirmed: "Recovery Key not confirmed",
      ready: "Ready",
      backupFailed: "Backup failed",
    },
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
    localQaTitle: "Local QA",
    localQaDescription: "Reset or switch local-only QA scenarios without touching a real account.",
    localQaReset: "Reset current scenario",
    localQaOpenTools: "Open QA tools",
    localQaExit: "Exit local QA",
  },

  privateBackup: {
    title: "Private Backup",
    status: {
      notSetUp: "Private Backup off",
      recoveryKeyNotConfirmed: "Save Recovery Key",
      ready: "Recovery Key saved",
      backupFailed: "Backup needs retry",
    },
    notSetupTitle: "Save a private backup",
    notSetupBody:
      "Fidy can save a backup that only your Recovery Key or a trusted device can unlock.",
    confirmTitle: "Save your Recovery Key now",
    confirmBody:
      "Same-device restore can stay quiet, but a new phone needs your saved Recovery Key. Fidy cannot recreate it later.",
    readyTitle: "Your backup is healthy",
    readyBody:
      "This device can restore quietly, and a new phone can unlock the same backup with your saved Recovery Key.",
    failedTitle: "Backup upload failed",
    failedBody: "Your current phone still has your data. Retry when your connection is steady.",
    recoveryKeyLabel: "Recovery Key",
    recoveryKeyHelper:
      "Save it to a password manager, iCloud Passwords, or Bitwarden. Copy and paste should be the default path.",
    confirmPlaceholder: "Paste your Recovery Key",
    saveKey: "Save Recovery Key",
    savingBackup: "Saving backup...",
    finishLater: "Finish later",
    setUp: "Set up Private Backup",
    retryBackup: "Retry backup",
    viewKey: "View key",
    rotateKey: "Rotate key",
    encryptedBackupTitle: "Encrypted backup",
    encryptedBackupBody: "Last backup %{backupDate}",
    recoveryKeySavedTitle: "Recovery Key saved",
    recoveryKeySavedBody: "Stored in your password manager",
    newPhoneTitle: "New phone restore",
    newPhoneBody: "Paste the key after sign-in to unlock",
    privacyNote:
      "Login finds the backup account. Only the Recovery Key or a trusted device unlocks it.",
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
