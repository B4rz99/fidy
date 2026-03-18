const es = {
  // Common
  common: {
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    confirm: "Confirmar",
    dismiss: "Descartar",
    category: "Categoría",
    description: "Descripción",
    amount: "Monto",
    date: "Fecha",
    type: "Tipo",
    status: "Estado",
    active: "Activo",
    deleted: "Eliminado",
    unknown: "Desconocido",
    transaction: "Transacción",
    none: "(ninguno)",
    name: "Nombre",
    other: "Otro",
  },

  // Tab navigation
  tabs: {
    home: "Inicio",
    ai: "IA",
    add: "Agregar",
    calendar: "Calendario",
    settings: "Ajustes",
    budgets: "Presupuestos",
    menu: "Menú",
  },

  // Transactions
  transactions: {
    expense: "Gasto",
    income: "Ingreso",
    saveTransaction: "Guardar Transacción",
    descriptionOptional: "Descripción (opcional)",
    noTransactionsYet: "Aún no hay transacciones",
    noTransactionsHint:
      "Conecta una cuenta de correo o agrega transacciones manualmente para comenzar",
  },

  // Bills / Calendar
  bills: {
    addBill: "Agregar Gasto Fijo",
    editBill: "Editar Gasto Fijo",
    frequency: "Frecuencia",
    startDate: "Fecha de inicio",
    saveChanges: "Guardar Cambios",
    add: "Agregar",
    deleteBill: "Eliminar Gasto Fijo",
    deleteBillConfirm: '¿Estás seguro de que quieres eliminar "%{billName}"?',
    noBillsOnDay: "No hay gastos fijos este día",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
    yearly: "Anual",
  },

  // Calendar
  calendar: {
    title: "Calendario",
    weekdays: {
      mon: "L",
      tue: "M",
      wed: "X",
      thu: "J",
      fri: "V",
      sat: "S",
      sun: "D",
    },
  },

  // Presupuestos
  budgets: {
    title: "Presupuestos",
    empty: {
      title: "Aún no hay presupuestos",
      subtitle: "Establece límites de gasto y controla tu dinero",
      autoSetup: "Configurar desde el mes pasado",
      createManually: "Crear manualmente",
    },
    create: {
      title: "Crear Presupuesto",
      selectCategory: "Selecciona una categoría",
      enterAmount: "Monto del presupuesto mensual",
      lastMonthHint: "Gastaste %{amount} en %{category} el mes pasado",
    },
    edit: {
      title: "Editar Presupuesto",
    },
    card: {
      remaining: "%{amount} restante",
      over: "%{amount} sobre el presupuesto",
      used: "%{percent}% usado",
    },
    summary: {
      totalBudget: "Presupuesto Total",
      used: "%{percent}% usado",
    },
    alerts: {
      nearLimitTitle: "Advertencia de presupuesto",
      overBudgetTitle: "¡Presupuesto superado!",
      nearLimit: "%{category} está al %{percent}% del presupuesto",
      overBudget: "%{category} excedió el presupuesto al %{percent}%",
    },
    autoSuggest: {
      title: "Configurar Presupuestos",
      subtitle: "Basado en los gastos del mes pasado",
      skipAll: "Omitir",
      acceptSelected: "Aceptar seleccionados",
      noSuggestions: "Sin datos de gastos del mes pasado",
    },
    upcomingBills: {
      title: "Próximos Gastos Fijos",
      seeAll: "Ver todos",
      noBills: "No hay gastos fijos próximos",
    },
    copyForward: {
      prompt: "¿Copiar presupuestos del mes pasado?",
      accept: "Copiar presupuestos",
      skip: "Empezar de cero",
    },
  },

  // Date labels
  dates: {
    today: "Hoy",
    yesterday: "Ayer",
    todayWithDate: "Hoy, %{date}",
  },

  // Login
  login: {
    tagline: "tus finanzas, simplificadas.",
    continueWithGoogle: "Continuar con Google",
    continueWithMicrosoft: "Continuar con Microsoft",
    legalText: "Al continuar, aceptas nuestros Términos de Servicio\ny Política de Privacidad.",
  },

  // Connected Accounts
  connectedAccounts: {
    title: "Cuentas Conectadas",
    subtitle:
      "Administra tus cuentas conectadas y fuentes de captura para el seguimiento automático de transacciones.",
    connected: "Conectado",
    notConnected: "No conectado",
    connectDescription: "Conecta tu cuenta de %{provider} para capturar correos bancarios.",
    connectProvider: "Conectar %{provider}",
    disconnect: "Desconectar",
    lastSynced: "Última sincronización: %{time}",
    notSyncedYet: "No sincronizado aún",
    syncing: "Sincronizando...",
  },

  // Failed Emails
  failedEmails: {
    title: "Correos No Procesados",
    subtitle:
      "Estos correos bancarios no pudieron procesarse automáticamente. Puedes agregarlos como transacciones manualmente.",
    empty: "No hay correos sin procesar",
    addManually: "Agregar manualmente",
    parseFailedReason: "No se pudo extraer datos de la transacción",
    parseErrorReason: "Error al procesar el correo",
  },

  // Email Capture
  emailCapture: {
    autoCapture: "Auto-captura de transacciones",
    connectDescription: "Conecta tu correo para capturar transacciones bancarias automáticamente.",
    unprocessedEmails: {
      one: "%{count} correo sin procesar",
      other: "%{count} correos sin procesar",
    },
    tapToReview: "Toca para revisar y agregar manualmente",
  },

  // Progress
  progress: {
    fetchingTitle: "Obteniendo tus correos...",
    fetchingSubtitle: "Leyendo los últimos 30 días",
    scanningTitle: "Escaneando correos...",
    processingSubtitle: "%{completed} de %{total}",
    completeTitle: "¡Importación completa!",
    completeSubtitle: "Se encontraron %{saved} transacciones de %{total} correos",
    failedSuffix: " (%{failed} no se pudieron leer)",
    transactionsFound: {
      one: "%{count} transacción encontrada",
      other: "%{count} transacciones encontradas",
    },
  },

  // Needs Review
  needsReview: {
    title: "Revisar Transacciones",
    allCaughtUp: "¡Todo al día!",
    noReviewNeeded: "No hay transacciones pendientes de revisión.",
    count: {
      one: "%{count} transacción necesita revisión",
      other: "%{count} transacciones necesitan revisión",
    },
    lowConfidence: "Análisis de baja confianza",
    lowConfidenceHint:
      "Estas fueron analizadas con baja confianza. Por favor confirma o corrige la categoría.",
    bankNotification: "Notificación bancaria",
  },

  // Sync Conflicts
  syncConflicts: {
    title: "Conflictos de Sincronización",
    allResolved: "¡Todo resuelto!",
    noConflicts: "No hay conflictos de sincronización.",
    count: {
      one: "%{count} conflicto de sincronización necesita revisión",
      other: "%{count} conflictos de sincronización necesitan revisión",
    },
    changesFromDevice: "Cambios desde otro dispositivo",
    yourVersion: "Tu versión",
    syncedVersion: "Versión sincronizada",
    keepMine: "Mantener mía",
    acceptSynced: "Aceptar sincronizada",
  },

  // Chart Section
  chart: {
    dailySpending: "Gasto Diario",
    last30Days: "Últimos 30 días",
    avgPerDay: "Prom/día",
    thisMonthTotal: "Total del mes",
    spent: "gastado",
  },

  // AI Chat
  aiChat: {
    title: "Chat IA",
    fidyAi: "Fidy IA",
    memories: "Memorias",
    noConversations: "Aún no hay conversaciones",
    tapToStart: "Toca + para iniciar un nuevo chat",
    placeholder: "Pregunta sobre tus finanzas...",
    cleanupMessage: {
      one: "%{count} conversación expirada fue eliminada",
      other: "%{count} conversaciones expiradas fueron eliminadas",
    },
    askAnything: "Pregúntame lo que quieras sobre tus finanzas",
    suggestions: {
      monthSpending: "¿Cuánto gasté este mes?",
      biggestExpense: "¿Cuál es mi mayor gasto?",
      compareMonths: "Compara mis gastos con el mes pasado",
      addExpense: "Agrega un gasto de comida para hoy",
    },
    memoriesDescription:
      "Cosas que Fidy IA recuerda sobre ti. Elimina cualquier recuerdo que quieras que olvide.",
    noMemories: "Aún no hay recuerdos",
    noMemoriesHint: "Fidy IA aprenderá sobre ti mientras chateas",
    memoryCategories: {
      habit: "Hábito",
      preference: "Preferencia",
      situation: "Situación",
      goal: "Meta",
    },
  },

  // Settings
  settings: {
    title: "Ajustes",
    accountSection: "CUENTA",
    preferencesSection: "PREFERENCIAS",
    connectionsSection: "CONEXIONES",
    appSection: "APLICACIÓN",
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    language: "Idioma",
    languageEnglish: "English",
    languageSpanish: "Español",
    connectedEmails: "Correos Conectados",
    connectedEmailsCount: {
      one: "%{count} cuenta",
      other: "%{count} cuentas",
    },
    notifications: "Notificaciones",
    helpSupport: "Ayuda y Soporte",
    privacyPolicy: "Política de Privacidad",
    termsOfService: "Términos de Servicio",
    version: "Versión",
    deleteAccount: "Eliminar Cuenta",
    deleteAccountTitle: "Eliminar Cuenta",
    deleteAccountWarning:
      "Esto eliminará permanentemente tu cuenta y todos tus datos. Esta acción no se puede deshacer.",
    deleteAccountUnsyncedWarning: {
      one: "Tienes %{count} cambio sin sincronizar que se perderá.",
      other: "Tienes %{count} cambios sin sincronizar que se perderán.",
    },
    deleteAccountConfirm: "Eliminar Mi Cuenta",
    profileTitle: "Perfil",
    logout: "Cerrar Sesión",
    logoutConfirmTitle: "Cerrar Sesión",
    logoutConfirmMessage: "¿Estás seguro de que quieres cerrar sesión?",
  },

  // Notification Capture
  notificationCapture: {
    title: "Captura de Notificaciones",
    description: "Captura automáticamente transacciones de las notificaciones de tu app bancaria.",
    listening: "Escuchando",
    permissionRequired: "Permiso requerido",
    grantAccess: "Conceder Acceso",
  },

  // Apple Pay / SMS (already Spanish)
  applePay: {
    title: "Apple Pay",
    connected: "Conectado",
    notSetUp: "No configurado",
    description: "Captura automática de transacciones cuando pagas con Apple Pay.",
    steps: [
      "Abre la app Atajos en tu iPhone",
      "Toca Automatización > + > Transacción",
      "Selecciona tu tarjeta y toca Siguiente",
      "Busca 'Fidy' > 'Registrar transacción' > Activa 'Ejecutar inmediatamente'",
    ],
  },

  smsDetection: {
    title: "Detección de SMS bancarios",
    description: "Detecta cuando recibes SMS de tu banco para recordarte registrar la transacción.",
    steps: [
      "Abre la app Atajos en tu iPhone",
      "Toca Automatización > + > Mensaje",
      "Selecciona los números de tu banco y toca Siguiente",
      "Busca 'Fidy' > 'Detectar SMS bancario' > Activa 'Ejecutar inmediatamente'",
    ],
  },

  // Search
  search: {
    title: "Buscar",
    placeholder: "Buscar transacciones...",
    category: "Categoría",
    dateRange: "Rango de fechas",
    amount: "Monto",
    type: "Tipo",
    clearAll: "Limpiar todo",
    noResults: "No hay transacciones",
    clearFilters: "Limpiar filtros",
    resultsSummary: "%{count} transacciones · %{total} total",
    today: "Hoy",
    thisWeek: "Esta semana",
    thisMonth: "Este mes",
    lastMonth: "Mes pasado",
    customRange: "Rango personalizado",
    from: "Desde",
    to: "Hasta",
    min: "Mín",
    max: "Máx",
    allTypes: "Todos",
  },

  // Detected Transactions Banner (already Spanish)
  detectedTransactions: {
    count: {
      one: "%{count} movimiento bancario hoy",
      other: "%{count} movimientos bancarios hoy",
    },
    subtitle: "SMS detectados - toca para revisar",
  },
} as const;

export default es;
