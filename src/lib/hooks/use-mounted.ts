import { useEffect, useState } from "react";

/** True after the first client render. Use to gate browser-only UI. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
