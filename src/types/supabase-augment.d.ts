// Widen createClient's return type so generated email-queue route compiles
// even when called without explicit Database generic.
import "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
}
