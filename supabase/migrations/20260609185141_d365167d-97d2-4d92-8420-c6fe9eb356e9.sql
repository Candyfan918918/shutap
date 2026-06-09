-- 1. City courts admin columns
ALTER TABLE public.city_courts
  ADD COLUMN IF NOT EXISTS nomination_cap integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "city_courts admin write" ON public.city_courts;
CREATE POLICY "city_courts admin write" ON public.city_courts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.city_courts TO anon, authenticated;
GRANT ALL ON public.city_courts TO service_role;

-- 2. Court cases flip window columns + extra status
ALTER TABLE public.court_cases
  DROP CONSTRAINT IF EXISTS court_cases_status_check;
ALTER TABLE public.court_cases
  ADD CONSTRAINT court_cases_status_check
  CHECK (status = ANY (ARRAY['nominated','in_court','judgment_pending','decided','legendary','paused','rejected']));

ALTER TABLE public.court_cases
  ADD COLUMN IF NOT EXISTS flip_window_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS flip_window_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_flip_verdict text,
  ADD COLUMN IF NOT EXISTS is_flip_round boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flip_round_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS og_image_url text;

ALTER TABLE public.post_verdict_votes
  ADD COLUMN IF NOT EXISTS flip_round integer NOT NULL DEFAULT 1;

-- 3. Mod queue
CREATE TABLE IF NOT EXISTS public.mod_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.court_cases(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('pii_suspected','mass_flag','legal_risk','manual_hold','rate_limited')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  moderator_id uuid REFERENCES auth.users(id),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mod_queue TO authenticated;
GRANT ALL ON public.mod_queue TO service_role;

ALTER TABLE public.mod_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mod_queue admin all" ON public.mod_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_mod_queue_status ON public.mod_queue(status, created_at DESC);

DROP TRIGGER IF EXISTS trg_mod_queue_updated_at ON public.mod_queue;
CREATE TRIGGER trg_mod_queue_updated_at
  BEFORE UPDATE ON public.mod_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Bench voice strings (multi-language)
CREATE TABLE IF NOT EXISTS public.bench_voice_strings (
  key text NOT NULL,
  locale text NOT NULL,
  text text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale)
);

GRANT SELECT ON public.bench_voice_strings TO anon, authenticated;
GRANT ALL ON public.bench_voice_strings TO service_role;

ALTER TABLE public.bench_voice_strings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bench_voice_strings public read" ON public.bench_voice_strings
  FOR SELECT USING (true);

CREATE POLICY "bench_voice_strings admin write" ON public.bench_voice_strings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed canonical English Bench strings
INSERT INTO public.bench_voice_strings (key, locale, text) VALUES
  ('verdict.red_flag',          'en', 'Final Verdict: RED FLAG. {pct}% of the jury called it.'),
  ('verdict.green_flag',        'en', 'Final Verdict: GREEN FLAG. {pct}% says keep them.'),
  ('verdict.run',               'en', 'Final Verdict: RUN. {pct}% of the internet agrees.'),
  ('verdict.talk_it_out',       'en', 'Final Verdict: Talk It Out. This one deserves one honest conversation.'),
  ('verdict.lawyer_up',         'en', 'Final Verdict: Lawyer Up. {pct}% said it is that serious.'),
  ('verdict.therapy_might_help','en', 'Final Verdict: Therapy Might Help.'),
  ('verdict.need_update',       'en', 'Final Verdict: Need Update.'),
  ('verdict.no_verdict',        'en', 'The jury was split. No clear verdict.'),
  ('flip.opened',               'en', 'New evidence dropped. Re-vote open for 6 hours.'),
  ('flip.ribbon',               'en', 'Flip Round Active'),
  ('flip.cta',                  'en', 'Your earlier vote was {prior}. Change it?'),
  ('mod.rejected',              'en', 'Bench declined to hear this one. Try a different framing.'),
  ('mod.approved',              'en', 'Bench accepted the case. Court is open.'),
  ('og.headline.in_court',      'en', 'Now in {region} Court'),
  ('og.headline.decided',       'en', 'Verdict in from {region} Court')
ON CONFLICT (key, locale) DO NOTHING;

-- Spanish
INSERT INTO public.bench_voice_strings (key, locale, text) VALUES
  ('verdict.red_flag',          'es', 'Veredicto Final: BANDERA ROJA. {pct}% del jurado lo confirma.'),
  ('verdict.green_flag',        'es', 'Veredicto Final: BANDERA VERDE. {pct}% dice que te lo quedes.'),
  ('verdict.run',               'es', 'Veredicto Final: HUYE. {pct}% de internet está de acuerdo.'),
  ('verdict.talk_it_out',       'es', 'Veredicto Final: Hablen. Esto merece una conversación honesta.'),
  ('verdict.no_verdict',        'es', 'El jurado quedó dividido. Sin veredicto.'),
  ('flip.ribbon',               'es', 'Ronda de Vuelco Activa'),
  ('flip.cta',                  'es', 'Tu voto anterior fue {prior}. ¿Cambiarlo?'),
  ('og.headline.decided',       'es', 'Veredicto desde el Tribunal de {region}')
ON CONFLICT (key, locale) DO NOTHING;

-- Portuguese (BR)
INSERT INTO public.bench_voice_strings (key, locale, text) VALUES
  ('verdict.red_flag',          'pt-BR', 'Veredito Final: BANDEIRA VERMELHA. {pct}% do júri confirma.'),
  ('verdict.green_flag',        'pt-BR', 'Veredito Final: BANDEIRA VERDE. {pct}% diz para ficar.'),
  ('verdict.run',               'pt-BR', 'Veredito Final: CORRA. {pct}% da internet concorda.'),
  ('verdict.no_verdict',        'pt-BR', 'O júri ficou dividido. Sem veredito.'),
  ('flip.ribbon',               'pt-BR', 'Rodada de Reviravolta Ativa'),
  ('og.headline.decided',       'pt-BR', 'Veredito do Tribunal de {region}')
ON CONFLICT (key, locale) DO NOTHING;

-- French
INSERT INTO public.bench_voice_strings (key, locale, text) VALUES
  ('verdict.red_flag',          'fr', 'Verdict Final : DRAPEAU ROUGE. {pct}% du jury confirme.'),
  ('verdict.green_flag',        'fr', 'Verdict Final : DRAPEAU VERT. {pct}% dit de garder.'),
  ('verdict.run',               'fr', 'Verdict Final : FUIS. {pct}% d''internet est d''accord.'),
  ('verdict.no_verdict',        'fr', 'Jury partagé. Aucun verdict.'),
  ('flip.ribbon',               'fr', 'Manche de Revirement Active'),
  ('og.headline.decided',       'fr', 'Verdict du Tribunal de {region}')
ON CONFLICT (key, locale) DO NOTHING;

-- German
INSERT INTO public.bench_voice_strings (key, locale, text) VALUES
  ('verdict.red_flag',          'de', 'Urteil: ROTE FLAGGE. {pct}% der Jury bestätigt es.'),
  ('verdict.green_flag',        'de', 'Urteil: GRÜNE FLAGGE. {pct}% sagen, behalte sie.'),
  ('verdict.run',               'de', 'Urteil: LAUF. {pct}% des Internets stimmen zu.'),
  ('verdict.no_verdict',        'de', 'Jury gespalten. Kein Urteil.'),
  ('flip.ribbon',               'de', 'Wende-Runde Aktiv'),
  ('og.headline.decided',       'de', 'Urteil aus dem {region}-Gericht')
ON CONFLICT (key, locale) DO NOTHING;
