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

  // Menu
  menu: {
    connectedMails: "Correos Conectados",
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
