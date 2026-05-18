/**
 * Attach the current Supabase access token as a Bearer header on outgoing
 * same-origin fetches that don't already carry an authorization header.
 * This lets TanStack server functions guarded by requireSupabaseAuth see the user.
 */
import { supabase } from "@/integrations/supabase/client";

let installed = false;

export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const isAbsolute = /^https?:\/\//i.test(url);
      const sameOrigin = !isAbsolute || url.startsWith(window.location.origin);
      if (sameOrigin) {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        if (!headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            headers.set("authorization", `Bearer ${token}`);
            return orig(input, { ...init, headers });
          }
        }
      }
    } catch {
      // fall through
    }
    return orig(input, init);
  };
}
