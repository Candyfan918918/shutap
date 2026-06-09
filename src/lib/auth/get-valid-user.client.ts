import { supabase } from "@/integrations/supabase/client";

export async function getValidUserSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { session: null, user: null };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  return { session, user: data.user };
}