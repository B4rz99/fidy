const es = {
  // Common
  common: {
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    confirm: "Confirmar",
    dismiss: "Descartar",
    edit: "Editar",
    category: "Categoría",
    description: "Descripción",
    amount: "Monto",
    date: "Fecha",
    type: "Tipo",
    status: "Estado",
    active: "Activo",
    deleted: "Eliminado",
    unknown: "Desconocido",
    addTransaction: "Agregar transacción",
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
    finance: "Finanzas",
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
    deleteConfirmTitle: "Eliminar Transacción",
    deleteConfirmMessage: "¿Estás seguro de que quieres eliminar esta transacción?",
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

  // Categorías
  categories: {
    title: "Categorías",
    settingsRow: "Categorías",
    builtInSection: "PREDETERMINADAS",
    customSection: "PERSONALIZADAS",
    addCategory: "Agregar categoría",
    noCustomCategories: "Aún no hay categorías personalizadas",
    create: {
      title: "Nueva categoría",
      nameLabel: "Nombre de la categoría",
      namePlaceholder: "ej. Mascotas",
      iconLabel: "Elige un ícono",
      colorLabel: "Elige un color",
      submit: "Crear categoría",
    },
    errors: {
      nameTooShort: "El nombre debe tener al menos 2 caracteres",
      nameTooLong: "El nombre debe tener menos de 32 caracteres",
      iconRequired: "Por favor selecciona un ícono",
      colorRequired: "Por favor selecciona un color",
      saveFailed: "No se pudo guardar la categoría",
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

  // Metas
  goals: {
    title: "Metas",
    empty: {
      title: "Aún no hay metas",
      subtitle: "Establece metas de ahorro y sigue tu progreso",
      createGoal: "Crear una meta",
    },
    create: {
      title: "Crear Meta",
      goalName: "Nombre de la meta",
      goalNamePlaceholder: "ej., Viaje a Holanda",
      targetAmount: "Monto objetivo",
      targetDate: "Fecha objetivo (opcional)",
      interestRate: "Tasa de interés anual (%)",
      typeSavings: "Ahorro",
      typeDebt: "Deuda",
      projectionHint: "Basado en tus ingresos, ~%{months} meses",
      noProjectionHint: "Agrega transacciones de ingreso para una proyección",
    },
    edit: {
      title: "Editar Meta",
      saveChanges: "Guardar Cambios",
      deleteGoal: "Eliminar Meta",
      deleteConfirmTitle: "Eliminar Meta",
      deleteConfirmMessage: '¿Estás seguro de que quieres eliminar "%{goalName}"?',
    },
    card: {
      installments: "%{current}/%{total}",
      almostThere: "¡Ya casi!",
      completed: "¡Completado!",
      addPayment: "+ Agregar Pago",
    },
    detail: {
      contributions: "Contribuciones",
      aiPlan: "Plan IA",
      estimated: "Estimado: %{date}",
      roughEstimate: "Estimado aproximado (~%{months} meses)",
      setTargetDate: "Establece una fecha objetivo para seguimiento",
      spendingExceedsIncome:
        "Los gastos superan los ingresos — establece una fecha objetivo para seguimiento manual",
      paymentTooLow: "El pago no cubre los intereses",
      progress: "%{percent}% completado",
      remaining: "%{amount} restante",
      addPayment: "Agregar Pago",
      noContributions: "Aún no hay contribuciones",
      contributionNote: "Nota: %{note}",
      recommendation: "Recomendación de Fidy",
      recommendationText: "Ahorra %{amount}/mes para alcanzar tu meta para %{date}.",
      recommendationTextNoDate: "Ahorra %{amount}/mes para alcanzar tu meta.",
      askFidy: "Pregúntale a Fidy por más ideas",
      manualPayment: "Pago manual",
    },
    payment: {
      title: "Agregar Pago",
      addPaymentCta: "+ Agregar Pago",
      amount: "Monto",
      noteOptional: "Nota (opcional)",
      notePlaceholder: "ej., Ahorro mensual",
      date: "Fecha",
    },
    milestones: {
      title: "Hitos Mensuales",
      target: "Meta: %{amount}",
    },
    nudges: {
      reduce: "Reduce %{category} en %{amount}/mes",
      impact: "%{months} mes antes",
      adjustBudget: "Ajustar presupuesto",
    },
    whatIf: {
      title: "¿Qué pasaría si ahorraras...",
      perMonth: "%{amount}/mes",
      projectedDate: "Alcanzarías tu meta para %{date}",
    },
    smartCard: {
      moreGoals: { one: "%{count} meta más", other: "%{count} metas más" },
    },
    celebration: {
      quarter: "¡25% alcanzado! ¡Sigue así!",
      half: "¡Vas por la mitad! ¡Gran progreso!",
      threeQuarter: "¡75% listo! ¡Ya casi!",
      complete: "¡Meta alcanzada!",
      descriptionProgress: "¡Estás avanzando muy bien en %{goalName}!",
      descriptionComplete: "¡Felicidades! Has alcanzado tu meta de ahorro para %{goalName}.",
      continueButton: "Continuar",
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
    memories: "Memoria",
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

  // Onboarding
  onboarding: {
    welcome: {
      hero: "Tus finanzas, en piloto automático",
      subtitle: "Conecta tu correo y deja que Fidy capture tus transacciones automáticamente.",
      getStarted: "Comenzar",
      alreadyHaveAccount: "Ya tengo una cuenta",
    },
    connectEmail: {
      title: "Conecta tu correo",
      description:
        "Escanearemos tu bandeja de entrada en busca de correos bancarios y capturaremos transacciones automáticamente.",
      trustBadge: "Tus datos se quedan en tu dispositivo",
      skipForNow: "Omitir por ahora",
    },
    syncing: {
      processing: "Sincronizando tus transacciones...",
      transactionsFound: {
        one: "%{count} transacción encontrada",
        other: "%{count} transacciones encontradas",
      },
      recentCaptures: "Capturas recientes",
      helperText: "Esto puede tomar un momento",
      continue: "Continuar",
    },
    budgetSetup: {
      title: "Configura tus primeros presupuestos",
      subtitle: "Basado en tus gastos recientes",
      perMonth: "/mes",
      basedOnSpending: "Basado en los gastos del mes pasado",
      saveBudgets: "Guardar Presupuestos",
      skipForNow: "Omitir por ahora",
      noSuggestions:
        "Aún no hay datos de gastos — puedes configurar presupuestos después desde la pestaña de Presupuestos.",
    },
    complete: {
      title: "¡Todo listo!",
      stats:
        "Encontramos %{transactionCount} transacciones y configuramos %{budgetCount} presupuestos para ti.",
      goToDashboard: "Ir al Panel",
    },
  },

  // Guidance
  guidance: {
    budgetAlert80: {
      food: "Te quedan %{remaining} para %{daysLeft} días. Cocinar en casa unos días esta semana podría hacer rendir lo que queda.",
      transport:
        "Te quedan %{remaining} para %{daysLeft} días. Usar transporte público o combinar viajes donde puedas podría ahorrarte bastante.",
      entertainment:
        "Te quedan %{remaining} para %{daysLeft} días. Una tarde en casa o un paseo podría hacer rendir ese presupuesto un poco más.",
      health:
        "Te quedan %{remaining} para %{daysLeft} días. Si alguna cita puede esperar al próximo mes, eso podría liberar un poco.",
      education:
        "Te quedan %{remaining} para %{daysLeft} días. Saber cuáles pagos vienen pronto podría ayudarte a planear el resto del mes.",
      home: "Te quedan %{remaining} para %{daysLeft} días. Las compras del hogar que puedan esperar al próximo mes ayudarían a hacer rendir lo que queda.",
      clothing:
        "Te quedan %{remaining} para %{daysLeft} días. La ropa que pueda esperar hasta el próximo mes ayudaría a mantenerse dentro del presupuesto.",
      services:
        "Te quedan %{remaining} para %{daysLeft} días. Revisar si hay suscripciones que puedas pausar podría liberar algo de espacio.",
      transfer:
        "Te quedan %{remaining} para %{daysLeft} días. Limitar transferencias a lo necesario esta semana ayudaría a mantenerse dentro del presupuesto.",
      other:
        "Te quedan %{remaining} para %{daysLeft} días. Una mirada rápida a los gastos recientes podría mostrar dónde hay un poco de margen.",
    },
    budgetAlert100: {
      food: "Te pasaste %{overAmount}. Cocinar en casa unos días esta semana podría ayudar a recuperar el balance.",
      transport:
        "Te pasaste %{overAmount}. Combinar diligencias y compartir viajes donde puedas te ayudará.",
      entertainment:
        "Te pasaste %{overAmount}. Opciones gratuitas — caminar, streaming en casa, parques — pueden llevarte al próximo mes.",
      health:
        "Te pasaste %{overAmount}. Si algún chequeo puede esperar al próximo mes, eso ayudaría a balancear.",
      education:
        "Te pasaste %{overAmount}. Revisa si algún pago próximo puede aplazarse al mes siguiente.",
      home: "Te pasaste %{overAmount}. Aplazar mejoras del hogar hasta el próximo mes ayudaría a cerrar la diferencia.",
      clothing:
        "Te pasaste %{overAmount}. Saltarte compras de ropa este mes ayudaría a recuperar la diferencia.",
      services:
        "Te pasaste %{overAmount}. Pausar una o dos suscripciones este mes podría marcar la diferencia.",
      transfer:
        "Te pasaste %{overAmount}. Las transferencias no urgentes pueden esperar hasta el próximo mes.",
      other:
        "Te pasaste %{overAmount}. Revisar compras recientes de cerca podría revelar algunos ahorros fáciles.",
    },
  },
  notifications: {
    // Títulos
    budgetWarning: "%{category} — cerca de tu límite",
    budgetExceeded: "%{category} — presupuesto excedido",
    spendingAnomaly: "%{category} — %{multiplier}x tu promedio",
    budgetPace: "%{category} — en camino a exceder",
    goalMilestone: "%{goalName} — ¡%{percent}% ahorrado!",

    // Mensajes
    budgetWarningMsg: "$%{remaining} restantes para %{daysLeft} días",
    budgetExceededMsg: "$%{overAmount} de más — considera pausar hasta el próximo mes",
    spendingAnomalyMsg: "Tu gasto semanal es más alto de lo usual",
    budgetPaceMsg: "Proyectado $%{projected} vs $%{budget} presupuesto",
    goalMilestoneMsg: "Has ahorrado el %{percent}% de tu meta",

    // Encabezados de sección
    weeklyMovesHeader: "TUS MOVIMIENTOS · %{weekRange}",
    earlierHeader: "ANTERIORES",

    // Estado vacío
    emptyTitle: "Nada nuevo por ahora",
    emptySubtitle: "Te avisaremos cuando tus presupuestos o metas necesiten atención",

    // Placeholder primera semana (G8)
    firstWeekTitle: "Conociéndote",
    firstWeekMessage:
      "Fidy está conociendo tus gastos. Dame una semana y tendré tus primeros Movimientos listos.",

    // Pantalla
    title: "Notificaciones",
  },
} as const;

export default es;
