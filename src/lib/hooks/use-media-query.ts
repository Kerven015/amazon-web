import { useEffect, useState } from "react";

/** Live result of a CSS media query (false during the first render). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** A mouse or trackpad is the main pointer (desktop): no drag-to-swipe there. */
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");
