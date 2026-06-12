
-- 1) Profiles: restrict sensitive columns from anonymous reads via column-level grants.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, nickname, locale, country, region, city, created_at, updated_at,
  display_name, avatar_url, vibe, descriptor, city_label, country_code,
  onboarded_at, last_seen_at, handle, bio, anonymous_mode, avatar_kind,
  nationality, emotion, creature, emoji, justice_score, wisdom_score,
  empathy_score, prediction_score, juror_tier, juror_title, counsel_count,
  account_created_at
) ON public.profiles TO anon;

-- 2) admin_users: explicit restrictive deny for client roles.
DROP POLICY IF EXISTS "admin_users deny client access" ON public.admin_users;
CREATE POLICY "admin_users deny client access"
  ON public.admin_users
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 3) user_roles: explicit restrictive policies preventing self-promotion.
DROP POLICY IF EXISTS "user_roles restrict insert to admins" ON public.user_roles;
CREATE POLICY "user_roles restrict insert to admins"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "user_roles restrict update to admins" ON public.user_roles;
CREATE POLICY "user_roles restrict update to admins"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "user_roles restrict delete to admins" ON public.user_roles;
CREATE POLICY "user_roles restrict delete to admins"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
