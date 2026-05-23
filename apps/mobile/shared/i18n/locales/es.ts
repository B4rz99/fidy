const es = {
  // Common
  common: {
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    confirm: "Confirmar",
    dismiss: "Descartar",
    back: "Atrás",
    close: "Cerrar",
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
    account: "Cuenta",
    none: "(ninguno)",
    name: "Nombre",
    other: "Otro",
    clearAll: "Limpiar todo",
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

  // Dashboard
  dashboard: {
    average: "Promedio",
    categoryBars: "Gasto por categoría",
    dailyPace: "Diario",
    dailyPaceGuidance:
      "Puedes gastar hasta %{amount} al día para mantenerte dentro de tu presupuesto.",
    monthlySpend: "Gasto del mes",
    noBudgetGuidance:
      "Configura un presupuesto mensual para ver tu límite diario. Promedio actual: %{amount}.",
    spendingSummary: "Resumen del gasto mensual",
    spentThisMonth: "Gastado este mes",
  },

  accountSuggestions: {
    prompt: {
      count: {
        one: "%{count} sugerencia de cuenta lista",
        other: "%{count} sugerencias de cuenta listas",
      },
      subtitle: "Revísalas ahora para mejorar dónde caen las capturas recientes.",
    },
    review: {
      title: "Mejorar precisión",
      subtitle:
        "Crea o vincula ahora las sugerencias de cuenta más fuertes, u omítelas hasta que las necesites.",
      emptyTitle: "No hay sugerencias de cuenta ahora mismo",
      emptySubtitle: "Cuando la evidencia repetida apunte a una cuenta faltante, aparecerá aquí.",
      dismissFailed: "No se pudo descartar la sugerencia",
    },
    onboarding: {
      eyebrow: "REVISIÓN OPCIONAL DE CUENTAS",
      title: "Encontramos sugerencias fuertes de cuenta en tus capturas recientes.",
      subtitle:
        "Revisa primero las coincidencias más fuertes, o continúa y termina la configuración.",
      note: "Las coincidencias de mayor confianza se muestran primero para mantener el onboarding ágil.",
      continue: "Continuar a presupuestos",
    },
    card: {
      create: "Crear",
      linkExisting: "Vincular existente",
      skipForNow: "Omitir",
      confidenceHigh: "ALTA",
      confidenceMedium: "MEDIA",
      reasonLast4: "Encontramos esta tarjeta terminada en %{value}.",
      reasonAlias: "%{source} y %{value} aparecieron juntos en %{count} capturas.",
      reasonCardHint:
        "Las pistas de tarjeta de %{source} para %{value} aparecieron en %{count} capturas.",
      reasonCardProduct:
        "Vimos varias veces %{source} %{evidence}. Confirma si es una de tus tarjetas.",
      reasonAccountType:
        "Vimos varias veces %{source} %{evidence}. Confirma antes de crear una cuenta.",
    },
    create: {
      title: "Crear cuenta",
      subtitle:
        "Crea una cuenta financiera desde esta sugerencia. Podrás editar los detalles después.",
      nameLabel: "Nombre de la cuenta",
      kindLabel: "Tipo de cuenta",
      identifierLabel: "Evidencia del identificador",
      save: "Crear cuenta",
      saveFailed: "No se pudo crear la cuenta",
    },
    link: {
      title: "Vincular existente",
      subtitle:
        "Ordenamos primero las coincidencias más fuertes para que confirmes la cuenta correcta más rápido.",
      likelyMatches: "Coincidencias probables",
      allAccounts: "Todas las cuentas",
      linkFailed: "No se pudo vincular la cuenta",
    },
  },

  // Transactions
  transactions: {
    expense: "Gasto",
    income: "Ingreso",
    saved: "Transacción guardada",
    saveTransaction: "Guardar transacción",
    descriptionOptional: "Descripción (opcional)",
    noTransactionsYet: "Aún no hay transacciones",
    noTransactionsHint: "Conecta un correo o agrega tu primera transacción.",
    deleteConfirmTitle: "¿Eliminar transacción?",
    deleteConfirmMessage: "Ya no contará en tus gastos, presupuestos ni reportes.",
    keepTransaction: "Conservar transacción",
    deleteTransaction: "Eliminar transacción",
    editTransaction: "Editar transacción",
    convertToTransfer: "Convertir en transferencia",
    updateFailed: "La transacción no se actualizó. Revisa los datos e intenta de nuevo.",
    deleteFailed: "La transacción no se eliminó. Revisa tu conexión e intenta de nuevo.",
  },

  transfers: {
    title: "Nueva transferencia",
    reclassifyTitle: "Convertir en transferencia",
    subtitle:
      "Las transferencias mueven dinero entre cuentas rastreadas, efectivo u otra cuenta sin seguimiento.",
    reclassifySubtitle:
      "Reemplaza esta transacción capturada por la transferencia que realmente representa, sin perder la evidencia original.",
    outsideSubtitle:
      "Usa Fuera de Fidy cuando el otro lado sea efectivo u otra fuente que no rastreas.",
    conflictSubtitle:
      "Las transferencias necesitan dos lados distintos. Si el dinero empieza y termina en la misma cuenta, en realidad no se movió.",
    amountLabel: "Monto de la transferencia",
    fromLabel: "Desde",
    toLabel: "Hacia",
    dateLabel: "Fecha de transferencia",
    chooseSide: "Elegir lado",
    chooseSideHint: "Elige una cuenta, efectivo u otra cuenta sin seguimiento",
    chooseDifferentSide: "Elige otro lado",
    saved: "Transferencia guardada",
    save: "Registrar transferencia",
    outsideFidy: "Fuera de Fidy",
    outsideFidyDescription: "Efectivo u otra cuenta sin seguimiento",
    outsideHint:
      "¿Necesitas efectivo u otra cuenta sin seguimiento? Elígela explícitamente en lugar de guardar un gasto falso.",
    reclassifyHint:
      "Al guardar se sustituirá la transacción original, la evidencia de captura seguirá adjunta y el registro viejo dejará de contar como gasto.",
    outsideSelectedHint:
      "Fuera de Fidy mantiene esta transferencia explícita sin crear una cuenta o gasto falso.",
    conflictHint:
      "Elige dos lados distintos. Una transferencia no puede empezar y terminar en la misma cuenta financiera.",
    pickerTitle: "Elige el lado de la transferencia",
    pickerSubtitle:
      "Elige una cuenta financiera rastreada, o elige Fuera de Fidy para efectivo o fondos externos.",
    a11y: {
      amountField: "Editar monto de la transferencia",
      selectSide: "Seleccionar lado %{side}",
      changeDate: "Cambiar fecha de la transferencia",
    },
    errors: {
      amountRequired: "Ingresa el monto de la transferencia",
      sidesRequired: "Elige ambos lados antes de guardar",
      trackedAccountRequired: "Al menos un lado debe ser una cuenta rastreada",
      distinctSidesRequired: "Elige dos lados distintos",
      reclassifyFailed: "No se pudo convertir esta transacción en transferencia",
      saveFailed: "La transferencia no se guardó. Revisa ambos lados e intenta de nuevo.",
    },
    reclassifySave: "Convertir en transferencia",
    activity: {
      generic: "Transferencia",
      toAccount: "Transferencia a %{name}",
      fromAccount: "Transferencia desde %{name}",
      route: "%{from} -> %{to}",
    },
  },

  financialAccounts: {
    defaultName: "Efectivo",
    kinds: {
      checking: "Corriente",
      savings: "Ahorros",
      wallet: "Billetera",
      cash: "Efectivo",
      // biome-ignore lint/style/useNamingConvention: la llave coincide con FinancialAccountKind
      credit_card: "Tarjeta de crédito",
    },
    labels: {
      default: "Predeterminada",
      notDefault: "No",
      noOpeningBalance: "Sin definir",
      noBillingDay: "Sin definir",
    },
    list: {
      settingsRow: "Cuentas financieras",
      title: "Cuentas financieras",
      subtitle:
        "Crea y edita las cuentas que usas para saldos, transferencias y registro manual. La captura de correos y notificaciones sigue en Cuentas conectadas.",
      regularSection: "Efectivo y bancos",
      creditSection: "Tarjetas de crédito",
      emptyTitle: "Aún no hay cuentas financieras",
      emptySubtitle:
        "Agrega una cuenta cuando quieras manejar saldos y transferencias fuera del flujo de captura.",
      addCta: "Agregar cuenta",
      billingGap: "Faltan fechas del ciclo",
      identifiersCount: { one: "%{count} identificador", other: "%{count} identificadores" },
    },
    detail: {
      title: "Detalle de la cuenta",
      accountSection: "Detalles de la cuenta",
      openingBalanceSection: "Saldo inicial",
      billingProfileTitle: "Perfil de facturación",
      kindLabel: "Tipo de cuenta",
      defaultLabel: "Cuenta predeterminada",
      openingBalanceLabel: "Saldo inicial",
      startingDebtLabel: "Deuda inicial",
      effectiveDateLabel: "Fecha efectiva",
      identifiersTitle: "Identificadores",
      identifiersEmpty: "Aún no hay identificadores guardados.",
      manageIdentifiers: "Gestionar identificadores",
      editCta: "Editar cuenta",
      billingGapTitle: "Faltan fechas del ciclo",
      billingGapBody:
        "Las funciones de tarjetas por ciclo seguirán apagadas hasta que agregues el día de corte y el día límite de pago.",
    },
    form: {
      createTitle: "Agregar cuenta",
      editTitle: "Editar cuenta",
      createSubtitle: "Configura una cuenta que quieras seguir fuera del flujo de sugerencias.",
      editSubtitle: "Actualiza esta cuenta sin volver a pasar por onboarding.",
      nameLabel: "Nombre de la cuenta",
      namePlaceholder: "ej. Corriente Bancolombia",
      kindLabel: "Tipo de cuenta",
      balanceLabel: "Saldo inicial",
      debtLabel: "Deuda inicial",
      dateLabel: "Fecha efectiva",
      datePlaceholder: "Elige una fecha",
      dayPlaceholder: "Día",
      billingHint:
        "Opcional. Agrega el día de corte y el día límite de pago después si todavía no los tienes.",
      statementClosingDay: "Fecha de corte",
      paymentDueDay: "Fecha limite de pago",
      saveCreate: "Crear cuenta",
      saveEdit: "Guardar cambios",
      loading: "Cargando cuenta...",
      missingTitle: "No encontramos esta cuenta",
      missingBody:
        "Esta cuenta ya no está disponible. Vuelve a Cuentas financieras e intenta con otra.",
      missingCta: "Volver a cuentas",
      invalidOpeningBalance:
        "Agrega monto y fecha efectiva al mismo tiempo, o deja ambos campos vacíos.",
      invalidBillingDay: "Ingresa un día entre 1 y 31.",
      saveFailed: "La cuenta no se guardó. Revisa los datos e intenta de nuevo.",
    },
    identifierSheet: {
      title: "Agregar identificador",
      subtitle: "Guarda una pista estable que reconozcas después para esta cuenta.",
      label: "Identificador",
      placeholder: "ej. Visa gold",
      note: "Mantenlo corto y estable. Puedes agregar más pistas después.",
      save: "Guardar identificador",
      saveFailed: "El identificador no se guardó. Intenta de nuevo.",
    },
  },

  // Bills / Calendar
  bills: {
    addBill: "Agregar gasto fijo",
    editBill: "Editar gasto fijo",
    frequency: "Frecuencia",
    startDate: "Fecha de inicio",
    saveChanges: "Guardar cambios",
    add: "Agregar",
    deleteBill: "Eliminar gasto fijo",
    deleteBillConfirm:
      '¿Eliminar "%{billName}"? Se detendrán los recordatorios futuros de este gasto fijo.',
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
      saveFailed: "La categoría no se guardó. Elige nombre, ícono y color, e intenta de nuevo.",
    },
  },

  // Presupuestos
  budgets: {
    title: "Presupuestos",
    header: {
      previousMonthLabel: "Mes anterior",
      previousMonthHint: "Muestra los presupuestos del mes anterior",
      nextMonthLabel: "Mes siguiente",
      nextMonthHint: "Muestra los presupuestos del mes siguiente",
      addLabel: "Agregar presupuesto",
      addHint: "Abre el formulario para crear un presupuesto",
    },
    empty: {
      title: "Aún no hay presupuestos",
      subtitle: "Establece límites de gasto y controla tu dinero",
      autoSetup: "Configurar desde el mes pasado",
      createManually: "Crear manualmente",
    },
    create: {
      title: "Crear presupuesto",
      selectCategory: "Selecciona una categoría",
      enterAmount: "Monto del presupuesto mensual",
      lastMonthHint: "Gastaste %{amount} en %{category} el mes pasado",
    },
    edit: {
      title: "Editar presupuesto",
    },
    card: {
      remaining: "Quedan %{amount}",
      over: "%{amount} sobre el presupuesto",
      used: "%{percent}% usado",
      status: {
        onTrack: "Vas bien",
        nearLimit: "Cerca del límite",
        over: "Sobre el límite",
      },
    },
    summary: {
      totalBudget: "Presupuesto total",
      used: "%{percent}% usado",
      remaining: "Te quedan %{amount} para cerrar el mes.",
      over: "Te pasaste por %{amount} este mes.",
    },
    alerts: {
      nearLimitTitle: "Advertencia de presupuesto",
      overBudgetTitle: "¡Presupuesto superado!",
      nearLimit: "%{category} está al %{percent}% del presupuesto",
      overBudget: "%{category} excedió el presupuesto al %{percent}%",
    },
    autoSuggest: {
      title: "Configurar presupuestos",
      subtitle: "Basado en los gastos del mes pasado",
      skipAll: "Omitir",
      acceptSelected: "Aceptar seleccionados",
      noSuggestions: "Sin datos de gastos del mes pasado",
    },
    upcomingBills: {
      title: "Próximos gastos fijos",
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
      title: "Crear meta",
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
      title: "Editar meta",
      saveChanges: "Guardar cambios",
      deleteGoal: "Eliminar meta",
      deleteConfirmTitle: '¿Eliminar "%{goalName}"?',
      deleteConfirmMessage: "Esto quitará la meta de tus metas activas.",
      keepGoal: "Conservar meta",
    },
    card: {
      installments: "%{current}/%{total}",
      almostThere: "¡Ya casi!",
      completed: "¡Completado!",
      addPayment: "+ Agregar pago",
      paceAhead: "↑ Adelantado %{amount}",
      paceBehind: "↓ Atrasado %{amount}",
      startSaving: "Empieza a ahorrar",
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
      addPayment: "Agregar pago",
      noContributions: "Aún no hay contribuciones",
      contributionNote: "Nota: %{note}",
      recommendation: "Recomendación de Fidy",
      recommendationText: "Ahorra %{amount}/mes para alcanzar tu meta para %{date}.",
      recommendationTextNoDate: "Ahorra %{amount}/mes para alcanzar tu meta.",
      askFidy: "Pregúntale a Fidy por más ideas",
      manualPayment: "Pago manual",
    },
    payment: {
      title: "Agregar pago",
      addPaymentCta: "+ Agregar pago",
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
    continueInLocalQaMode: "Continuar en modo QA local",
    legalText: "Al continuar, aceptas nuestros Términos de Servicio\ny Política de Privacidad.",
  },

  // Connected Accounts
  connectedAccounts: {
    title: "Cuentas conectadas",
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

  // Email Capture
  emailCapture: {
    autoCapture: "Auto-captura de transacciones",
    connectDescription: "Conecta tu correo para capturar transacciones bancarias automáticamente.",
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

  financialMeaningReview: {
    bannerTitle: {
      one: "%{count} captura necesita revisión de significado",
      other: "%{count} capturas necesitan revisión de significado",
    },
    bannerSubtitle: "Todavía debemos confirmar si estas capturas son gasto o transferencias.",
    queueTitle: "Significado Financiero",
    queueCount: {
      one: "%{count} captura necesita significado financiero",
      other: "%{count} capturas necesitan significado financiero",
    },
    queueSubtitle:
      "Confirma qué representa cada captura antes de continuar con la atribución de cuenta.",
    emptyTitle: "No quedan revisiones de significado",
    emptySubtitle: "Todo en esta cola ya tiene un significado financiero confirmado.",
    reviewTitle: "Revisar Significado",
    reviewPill: "El significado todavía se ve ambiguo",
    reviewSubtitle:
      "Confirma si esta captura es un gasto real o si debe convertirse en transferencia.",
    reviewMeaning: "Revisar significado",
    dismiss: "Descartar",
    skip: "Omitir",
    itsTransaction: "Es una transacción",
    transfer: "Transferencia",
    whatWeDetected: "Interpretación actual",
    transactionDetected: "Capturado como gasto",
    transferHint:
      "Si esto fue dinero moviéndose entre cuentas, conviértelo en transferencia en lugar de dejarlo como gasto.",
    transferExplanation:
      "Convertirlo en transferencia reemplaza la transacción original y mantiene la evidencia unida al registro corregido.",
    providers: {
      gmail: "Captura de Gmail",
      outlook: "Captura de Outlook",
    },
    errors: {
      dismissFailed: "No se pudo descartar esta captura.",
      resolveFailed: "No se pudo resolver esta captura.",
    },
  },

  attributionReview: {
    bannerTitle: {
      one: "%{count} revisión de dueño está lista",
      other: "%{count} revisiones de dueño están listas",
    },
    bannerSubtitle: "Estas capturas todavía necesitan confirmar su cuenta financiera real.",
    queueTitle: "Atribución de Cuenta",
    queueCount: {
      one: "%{count} captura necesita revisión de dueño",
      other: "%{count} capturas necesitan revisión de dueño",
    },
    queueSubtitle:
      "Estas transacciones cuentan en el total, pero siguen provisionales hasta que confirmes la cuenta real.",
    emptyTitle: "No quedan revisiones de dueño",
    emptySubtitle: "Toda captura provisional con sugerencia ya fue confirmada o diferida.",
    provisionalLabel: "Dueño provisional",
    currentOwner: "Cuenta temporal",
    suggestedOwner: "Cuenta sugerida",
    confirmOwner: "Confirmar dueño",
    chooseAnother: "Elegir otra",
    skip: "Omitir",
    reviewTitle: "Revisar Dueño",
    reviewPill: "El dueño todavía se ve provisional",
    reviewSubtitle:
      "Una confirmación le enseña a Fidy qué cuenta debe ser dueña de capturas similares la próxima vez.",
    confirmAccount: "Confirmar cuenta",
    createNew: "Crear nueva",
    fallbackOwner: "Cuenta temporal",
    suggestedByEvidence: "Sugerida por evidencia repetida de captura",
    balanceHint:
      "Hasta que confirmes el dueño, esta transacción queda fuera de los balances por cuenta aunque sí cuente en el total.",
    errors: {
      confirmFailed: "No se pudo confirmar el dueño de la cuenta.",
    },
  },

  // Chart Section
  chart: {
    dailySpending: "Gasto Diario",
    last30Days: "Últimos 30 días",
    avgPerDay: "Prom/día",
    thisMonthTotal: "Total del mes",
    spent: "gastado",
    moreCategories: "%{count}+ más",
  },

  dateGroups: {
    today: "Hoy",
    yesterday: "Ayer",
  },

  // AI Chat
  aiChat: {
    title: "Chat IA",
    conversationsSubtitle: "Retoma una conversación o empieza una nueva consulta financiera.",
    fidyAi: "Fidy IA",
    memories: "Memoria",
    newChat: "Nuevo chat",
    noConversations: "Aún no hay conversaciones",
    tapToStart: "Toca + para iniciar un nuevo chat",
    placeholder: "Pregunta sobre tus finanzas...",
    scrollToBottom: "Ir al final",
    thinking: "Fidy está pensando",
    concierge: {
      label: "Asistente financiero",
      title: "Pregunta sin abrir hojas de cálculo.",
      subtitle:
        "Fidy puede explicar tu mes, encontrar gastos raros o ayudarte a registrar movimientos.",
    },
    cleanupMessage: {
      one: "%{count} conversación expirada fue eliminada",
      other: "%{count} conversaciones expiradas fueron eliminadas",
    },
    askAnything: "Pregúntame lo que quieras sobre tus finanzas",
    suggestions: {
      monthSpending: "¿Cuánto gasté este mes?",
      biggestExpense: "¿Cuál fue mi gasto más grande?",
      compareMonths: "Compara este mes con el anterior",
      addExpense: "Registra un gasto de almuerzo",
    },
    actions: {
      deleteTransaction: "Eliminar transacción",
    },
    status: {
      added: "Agregado",
      deleted: "Eliminado",
      dismissed: "Descartado",
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
    openSettings: "Abrir ajustes",
    accountSection: "CUENTA",
    preferencesSection: "PREFERENCIAS",
    connectionsSection: "CONEXIONES",
    privateBackupSection: "COPIA PRIVADA",
    privacySection: "PRIVACIDAD",
    appSection: "APLICACIÓN",
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    language: "Idioma",
    languageEnglish: "English",
    languageSpanish: "Español",
    connectedEmails: "Correos conectados",
    connectedEmailsCount: {
      one: "%{count} cuenta",
      other: "%{count} cuentas",
    },
    notifications: "Notificaciones",
    privateBackup: "Copia privada",
    parseImprovementSharing: "Mejorar lectura de capturas",
    parseImprovementSharingSubtitle:
      "Comparte formatos redactados de correos y notificaciones cuando falle una lectura. Primero se quitan montos, comercios, fechas, nombres y tarjetas.",
    privateBackupStatus: {
      notSetUp: "Sin configurar",
      recoveryKeyNotConfirmed: "Llave de recuperación sin confirmar",
      ready: "Lista",
      backupFailed: "Falló la copia",
    },
    on: "Activadas",
    off: "Desactivadas",
    helpSupport: "Ayuda y soporte",
    privacyPolicy: "Política de privacidad",
    termsOfService: "Términos de servicio",
    designSystem: "Sistema de diseño",
    designSystemSubtitle: "Previsualiza componentes compartidos",
    version: "Versión",
    deleteAccount: "Eliminar cuenta",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountWarning:
      "Esto eliminará permanentemente tu cuenta, tus copias privadas y todos tus datos remotos. Las copias privadas anteriores no se podrán recuperar después.",
    deleteAccountUnsyncedWarning: {
      one: "Tienes %{count} cambio sin sincronizar que se perderá.",
      other: "Tienes %{count} cambios sin sincronizar que se perderán.",
    },
    deleteAccountConfirm: "Eliminar mi cuenta",
    profileTitle: "Perfil",
    logout: "Cerrar sesión",
    logoutConfirmTitle: "¿Cerrar sesión?",
    logoutConfirmMessage:
      "Tendrás que iniciar sesión de nuevo para sincronizar o restaurar copias.",
    staySignedIn: "Seguir conectado",
    localQaTitle: "QA local",
    localQaDescription:
      "Reinicia o cambia escenarios de QA solo locales sin tocar una cuenta real.",
    localQaReset: "Reiniciar escenario actual",
    localQaOpenTools: "Abrir herramientas QA",
    localQaExit: "Salir del QA local",
  },

  designSystem: {
    title: "Sistema de diseño",
    heading: "Catálogo UI de Fidy",
    subtitle: "Una vista local para revisar componentes, tokens y estados de interacción.",
    typographySection: "TIPOGRAFÍA",
    colorsSection: "COLORES",
    buttonsSection: "BOTONES",
    cardsSection: "TARJETAS",
    rowsSection: "FILAS",
    titleSample: "Presupuesto mensual",
    bodySample: "Usa esta escala para textos, ayudas y metadatos de listas.",
    captionSample: "CAPTION / ETIQUETA DE APOYO",
    primaryButton: "Acción principal",
    secondaryButton: "Acción secundaria",
    dangerButton: "Acción peligrosa",
    ghostButton: "Acción fantasma",
    cardTitle: "Billetera de efectivo",
    cardSubtitle: "Cuenta predeterminada de gastos",
    calloutTitle: "Ritmo del presupuesto",
    rowTitle: "Fila de notificación",
    rowWithSubtitle: "Fila de insight",
    rowSubtitle: "El texto secundario se mantiene corto y factual.",
  },

  privateBackup: {
    title: "Copia privada",
    status: {
      notSetUp: "Copia privada apagada",
      recoveryKeyNotConfirmed: "Guarda tu llave",
      ready: "Llave guardada",
      backupFailed: "Reintenta la copia",
    },
    notSetupTitle: "Guarda una copia privada",
    notSetupBody:
      "Fidy puede guardar una copia que solo tu Llave de recuperación o un dispositivo confiable pueden abrir.",
    confirmTitle: "Guarda tu Llave de recuperación ahora",
    confirmBody:
      "Este celular puede restaurar sin pedir la llave, pero un celular nuevo necesita tu Llave de recuperación guardada. Fidy no puede recrearla después.",
    readyTitle: "Tu copia está saludable",
    readyBody:
      "Este dispositivo puede restaurar sin pedir la llave, y un celular nuevo puede abrir la misma copia con tu Llave de recuperación guardada.",
    failedTitle: "Falló la subida de la copia",
    failedBody:
      "Tu celular actual todavía tiene tus datos. Reintenta cuando la conexión esté estable.",
    recoveryKeyLabel: "Llave de recuperación",
    recoveryKeyHelper:
      "Guárdala en un gestor de contraseñas, iCloud Passwords o Bitwarden. Copiar y pegar debe ser el camino normal.",
    confirmPlaceholder: "Pega tu Llave de recuperación",
    saveKey: "Guardar Llave",
    savingBackup: "Guardando copia...",
    finishLater: "Terminar después",
    setUp: "Configurar copia privada",
    retryBackup: "Reintentar copia",
    viewKey: "Ver llave",
    rotateKey: "Rotar llave",
    encryptedBackupTitle: "Copia privada",
    encryptedBackupBody: "Última copia %{backupDate}",
    recoveryKeySavedTitle: "Llave guardada",
    recoveryKeySavedBody: "Guardada en tu gestor de contraseñas",
    newPhoneTitle: "Restaurar en celular nuevo",
    newPhoneBody: "Pega la llave después de iniciar sesión",
    privacyNote:
      "Iniciar sesión encuentra la cuenta de la copia. Solo la Llave de recuperación o un dispositivo confiable la abren.",
    keyUnavailable: "Esta Llave de recuperación ya no está disponible en la app.",
    confirmMismatchTitle: "Esa llave no coincide",
    confirmMismatchBody:
      "Pega la Llave de recuperación exactamente como aparece antes de marcar la copia como lista.",
    uploadFailedTitle: "La copia no se guardó",
    uploadFailedBody:
      "Revisa tu conexión e intenta de nuevo. Fidy todavía no marcará la copia como lista.",
    signInRequired: "Inicia sesión otra vez para que Fidy guarde esta copia privada en tu cuenta.",
    checklist: {
      passwordManager: "Guarda la llave en un gestor de contraseñas que ya confíes.",
      newDevice: "Pégala en un dispositivo nuevo cuando Fidy encuentre tu copia privada.",
      lostKey:
        "Si pierdes esta llave y también un dispositivo confiable, el historial anterior queda cerrado.",
    },
  },

  parseImprovementPrompt: {
    title: "¿Ayudar a mejorar la lectura?",
    body: "Podemos compartir este formato redactado para mejorar futuras lecturas:\n\n%{template}\n\nPrimero se quitan montos, comercios, fechas, nombres y tarjetas.",
    share: "Compartir formato redactado",
    notNow: "Ahora no",
  },

  errorFallback: {
    title: "Fidy no pudo cargar esta pantalla",
    body: "Cierra y vuelve a abrir la app. Si sigue pasando, tus datos locales siguen en este dispositivo.",
    restart: "Reiniciar app",
  },

  qaTools: {
    title: "Herramientas QA",
    subtitle:
      "Siembra escenarios locales determinísticos y abre directamente la pantalla que quieres revisar.",
    unavailable: "Las herramientas de QA local solo están disponibles en builds de desarrollo.",
    currentProfile: "Perfil actual: %{profile}",
    noActiveProfile: "No hay un perfil de QA local activo.",
    preparing: "Preparando escenario de QA local...",
    startFailed: "No se pudo iniciar el escenario QA seleccionado.",
    scenariosTitle: "Escenarios",
    flagsTitle: "Feature flags",
    actionsTitle: "Herramientas de reinicio",
    openTitle: "Abrir pantalla",
    openWithCurrentProfile: "Abrir el punto de entrada del perfil actual",
    logsTitle: "Inspector de logs",
    logsEmpty: "Todavía no hay logs de QA.",
    networkTitle: "Inspector de red",
    networkEmpty: "Todavía no hay solicitudes de red capturadas.",
    flagOn: "ENCENDIDO",
    flagOff: "APAGADO",
    banner: "Perfil QA: %{profile} · red: %{offline}",
    bannerOfflineOn: "simulada",
    bannerOfflineOff: "real",
    profiles: {
      default: {
        title: "Predeterminado",
        description: "Una cuenta de efectivo predeterminada y onboarding completo.",
      },
      "home-activity": {
        title: "Actividad de inicio",
        description: "Gastos recientes y una transferencia para QA visual del inicio.",
      },
      empty: {
        title: "Vacío",
        description: "Sin datos financieros y onboarding incompleto.",
      },
      "two-accounts": {
        title: "Dos cuentas",
        description: "Efectivo y Bancolombia sin actividad sembrada.",
      },
      "transfer-ready": {
        title: "Listo para transferir",
        description: "Dos cuentas rastreadas, transacciones sembradas y una transferencia.",
      },
      "transfer-conflict": {
        title: "Conflicto de transferencia",
        description:
          "Dos cuentas rastreadas con un conflicto prellenado de transferencia a la misma cuenta.",
      },
    },
    flags: {
      networkInspectorEnabled: {
        title: "Inspector de red",
        description: "Captura solicitudes fetch recientes con estado y duración.",
      },
      logInspectorEnabled: {
        title: "Inspector de logs",
        description:
          "Captura eventos de la app relacionados con QA en los límites de auth, siembra y harness.",
      },
      simulateOffline: {
        title: "Simular sin conexión",
        description:
          "Fuerza a que fallen las solicitudes fetch para probar estados offline y de error.",
      },
      showQaBanner: {
        title: "Mostrar banner QA",
        description: "Muestra un banner pequeño con el perfil QA activo y el modo de red actual.",
      },
    },
    actions: {
      resetCurrentScenario: "Reiniciar escenario actual",
      resetFlags: "Reiniciar feature flags",
      clearLogs: "Limpiar logs QA",
      clearNetwork: "Limpiar eventos de red",
      exitLocalQa: "Salir del QA local",
    },
    open: {
      home: "Inicio",
      addChooser: "Selector de agregar",
      onboarding: "Onboarding",
      addTransaction: "Agregar transacción",
      addTransfer: "Agregar transferencia",
      transferConflict: "Preset de conflicto de transferencia",
      financialAccounts: "Cuentas financieras",
      profile: "Perfil",
      qaTools: "Herramientas QA",
    },
  },

  // Notification Capture
  notificationCapture: {
    title: "Captura de notificaciones",
    description: "Captura automáticamente transacciones de las notificaciones de tu app bancaria.",
    listening: "Escuchando",
    permissionRequired: "Permiso requerido",
    grantAccess: "Conceder acceso",
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
      title: "Conecta tus correos",
      description:
        "Conecta cada bandeja donde recibas correos de bancos o tarjetas. Puedes sincronizar después de una cuenta o agregar otra primero.",
      connectGmail: "Conectar Gmail",
      connectOutlook: "Conectar Outlook",
      gmailConnected: "Gmail conectado",
      outlookConnected: "Outlook conectado",
      syncConnectedEmails: "Sincronizar correos conectados",
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
      backgroundHelperText: "Ya puedes continuar. Seguiremos importando el resto en segundo plano.",
      continue: "Continuar",
    },
    budgetSetup: {
      title: "Configura tus primeros presupuestos",
      subtitle: "Basado en tus gastos recientes",
      perMonth: "/mes",
      basedOnSpending: "Basado en los gastos del mes pasado",
      saveBudgets: "Guardar presupuestos",
      skipForNow: "Omitir por ahora",
      noSuggestions:
        "Aún no hay datos de gastos — puedes configurar presupuestos después desde la pestaña de Presupuestos.",
    },
    complete: {
      title: "¡Todo listo!",
      stats:
        "Encontramos %{transactionCount} transacciones y configuramos %{budgetCount} presupuestos para ti.",
      goToDashboard: "Ir al panel",
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
    budgetWarningMsg: "%{remaining} restantes para %{daysLeft} días",
    budgetExceededMsg: "%{overAmount} de más — considera pausar hasta el próximo mes",
    spendingAnomalyMsg: "Tu gasto semanal es más alto de lo usual",
    budgetPaceMsg: "Proyectado %{projected} vs %{budget} presupuesto",
    goalMilestoneMsg: "Has ahorrado el %{percent}% de tu meta",
    weeklyDigest: {
      title: "Tu semana en resumen",
      reminderTitle: "Tu resumen semanal está listo",
      reminderBody: "Abre Fidy para generarlo en privado desde este dispositivo.",
      spending: "Gastaste %{amount} esta semana",
      categoryOne: " principalmente en %{firstCategory}",
      categoryTwo: " principalmente en %{firstCategory} y %{secondCategory}",
      budgetOver: ". Superaste tu presupuesto - considera ajustar la proxima semana",
      budgetOnTrack: ". Vas al dia con tus presupuestos",
      goalContribution: ". Ahorraste %{amount} para tus metas",
    },

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

    // Preferencias
    preferences: {
      title: "Preferencias de Notificaciones",
      masterToggle: "Todas las Notificaciones",
      budgetAlerts: "Alertas de Presupuesto",
      budgetAlertsDesc: "Cuando te acerques o excedas tu presupuesto",
      goalMilestones: "Hitos de Metas",
      goalMilestonesDesc: "Actualizaciones sobre tus metas de ahorro y deuda",
      spendingAnomalies: "Alertas de Gasto",
      spendingAnomaliesDesc: "Patrones de gasto inusuales detectados",
      weeklyDigest: "Resumen Semanal",
      weeklyDigestDesc: "Resumen semanal cada domingo en la noche",
    },

    // Pantalla de pre-permiso
    enableNotifications: {
      title: "Mantente al día con tus finanzas",
      description:
        "Fidy puede alertarte cuando te acerques a tu límite de presupuesto, celebrar los hitos de tus metas, y enviarte un resumen semanal de tus finanzas.",
      enable: "Activar notificaciones",
      notNow: "Ahora no",
    },
  },

  // Analítica
  analytics: {
    title: "Analítica",
    incomeLabel: "Ingresos",
    expensesLabel: "Gastos",
    netPrefix: "Neto: ",
    spendingByCategory: "Gastos por Categoría",
    vsPreviousPeriod: {
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      W: "vs 7 días anteriores",
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      M: "vs 30 días anteriores",
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      Q: "vs 90 días anteriores",
      // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
      Y: "vs 365 días anteriores",
    },
    totalSpending: "Gasto total",
    noData: "No hay suficientes datos para este periodo",
  },
} as const;

export default es;
