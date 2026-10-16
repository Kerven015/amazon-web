import { useEffect, useState } from "react";

type PersistApi = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

/**
 * True once a persisted Zustand store has loaded from localStorage.
 * `persist` only exists in the browser, so it is read inside an effect.
 */
export function useStoreHydrated(store: PersistApi) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (store.persist.hasHydrated()) setHydrated(true);
    return store.persist.onFinishHydration(() => setHydrated(true));
  }, [store]);
  return hydrated;
}
