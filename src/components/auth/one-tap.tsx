import { useEffect } from "react";
import { cancelOneTap, showOneTap } from "@/lib/google";
import { useSession } from "@/lib/session";

/**
 * Google One Tap on shop pages: a signed-out visitor who is signed into Google sees
 * "Continue as …" (or, if they used it before, is signed in by itself).
 * Never shown to signed-in customers; hidden again as soon as they sign in.
 */
export function OneTap() {
  const status = useSession((s) => s.status);
  useEffect(() => {
    if (status === "signedOut") void showOneTap();
    if (status === "signedIn") cancelOneTap();
  }, [status]);
  return null;
}
