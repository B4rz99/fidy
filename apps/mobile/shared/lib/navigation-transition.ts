type TransitionEndNavigation = {
  readonly addListener: (
    event: "transitionEnd",
    callback: (event: TransitionEndEvent) => void
  ) => () => void;
};

type TransitionEndEvent = {
  readonly data?: {
    readonly closing?: boolean;
  };
};

type NavigationTransitionOptions = {
  readonly closing?: boolean;
  readonly fallbackMs?: number | null;
};

function hasTransitionListener(navigation: unknown): navigation is TransitionEndNavigation {
  return (
    typeof navigation === "object" &&
    navigation != null &&
    "addListener" in navigation &&
    typeof navigation.addListener === "function"
  );
}

export function runAfterNavigationTransition(
  navigation: unknown,
  callback: () => void,
  options: NavigationTransitionOptions = {}
): { readonly cancel: () => void } {
  const fallbackMs = options.fallbackMs === undefined ? 450 : options.fallbackMs;
  let settled = false;
  let fallback: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  const supportsTransitionEnd = hasTransitionListener(navigation);

  const finish = () => {
    if (settled) return;
    settled = true;
    if (fallback) clearTimeout(fallback);
    unsubscribe?.();
    callback();
  };
  if (supportsTransitionEnd) {
    unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (options.closing != null && event.data?.closing !== options.closing) return;
      finish();
    });
  }
  // Navigation events are preferred; fallback only prevents hanging if a platform skips the event.
  if (fallbackMs != null) fallback = setTimeout(finish, fallbackMs);

  return {
    cancel: () => {
      if (settled) return;
      settled = true;
      if (fallback) clearTimeout(fallback);
      unsubscribe?.();
    },
  };
}

export function waitForNavigationTransition(
  navigation: unknown,
  options: NavigationTransitionOptions = {}
): Promise<void> {
  return new Promise((resolve) => {
    runAfterNavigationTransition(navigation, resolve, options);
  });
}
