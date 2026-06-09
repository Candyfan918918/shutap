-- Option A: extend profiles + add alias pool tables (no parallel users table)

-- 1. Extend profiles with juror/scoring fields (alias + age + city already present)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS justice_score   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wisdom_score    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS empathy_score   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prediction_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juror_tier      text,
  ADD COLUMN IF NOT EXISTS juror_title     text,
  ADD COLUMN IF NOT EXISTS counsel_count   integer NOT NULL DEFAULT 0;

-- 2. Alias pool tables
CREATE TABLE IF NOT EXISTS public.alias_pool_nationalities (
  name text PRIMARY KEY
);
GRANT SELECT ON public.alias_pool_nationalities TO anon, authenticated;
GRANT ALL ON public.alias_pool_nationalities TO service_role;
ALTER TABLE public.alias_pool_nationalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alias nationalities readable" ON public.alias_pool_nationalities FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.alias_pool_emotions (
  name text PRIMARY KEY
);
GRANT SELECT ON public.alias_pool_emotions TO anon, authenticated;
GRANT ALL ON public.alias_pool_emotions TO service_role;
ALTER TABLE public.alias_pool_emotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alias emotions readable" ON public.alias_pool_emotions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.alias_pool_creatures (
  name text PRIMARY KEY
);
GRANT SELECT ON public.alias_pool_creatures TO anon, authenticated;
GRANT ALL ON public.alias_pool_creatures TO service_role;
ALTER TABLE public.alias_pool_creatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alias creatures readable" ON public.alias_pool_creatures FOR SELECT USING (true);

-- 3. Seeds (ON CONFLICT DO NOTHING avoids dup failures)
INSERT INTO public.alias_pool_nationalities(name) VALUES
('Italian'),('French'),('Japanese'),('Brazilian'),('Korean'),('Mexican'),('Nigerian'),
('Indian'),('Greek'),('Spanish'),('Turkish'),('Egyptian'),('Thai'),('Vietnamese'),
('Argentine'),('Moroccan'),('Ethiopian'),('Filipino'),('Indonesian'),('Polish'),
('Swedish'),('Irish'),('Portuguese'),('Lebanese'),('Peruvian'),('Kenyan'),
('Australian'),('Canadian'),('German'),('Dutch')
ON CONFLICT DO NOTHING;

INSERT INTO public.alias_pool_emotions(name) VALUES
('Curious'),('Chaotic'),('Hopeful'),('Petty'),('Wistful'),('Bold'),('Anxious'),
('Smug'),('Tender'),('Feral'),('Restless'),('Dreamy'),('Bitter'),('Glowing'),
('Reckless'),('Tired'),('Devoted'),('Suspicious'),('Lonely'),('Lovestruck'),
('Jaded'),('Optimistic'),('Mischievous'),('Sincere'),('Conflicted'),('Brave'),
('Stoic'),('Sentimental'),('Defiant'),('Quiet')
ON CONFLICT DO NOTHING;

INSERT INTO public.alias_pool_creatures(name) VALUES
('Fox'),('Owl'),('Otter'),('Lynx'),('Raven'),('Wolf'),('Panther'),('Hare'),
('Heron'),('Falcon'),('Tiger'),('Dolphin'),('Bear'),('Stag'),('Swan'),
('Octopus'),('Cheetah'),('Hummingbird'),('Koala'),('Jaguar'),('Peacock'),
('Mongoose'),('Capybara'),('Okapi'),('Narwhal'),('Platypus'),('Quokka'),('Wombat'),
('Monstera'),('Baobab'),('Lotus'),('Bamboo'),('Sequoia'),('Sakura'),('Dandelion'),('Fern'),
('Cactus'),('Orchid'),('Sunflower'),('Jasmine'),('Lavender'),('Magnolia'),('Willow'),
('Mangrove'),('Banyan'),('Cedar'),('Acacia'),('Bonsai'),('Iris'),('Poppy'),('Dahlia'),
('Peony'),('Anemone'),('Cosmos'),('Cichlid'),('Axolotl'),('Betta'),('Manta'),('Pufferfish'),
('Starfish'),('Nautilus'),('Clownfish'),('Barracuda')
ON CONFLICT DO NOTHING;