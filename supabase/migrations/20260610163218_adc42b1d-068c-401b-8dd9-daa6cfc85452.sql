
CREATE OR REPLACE FUNCTION public._tier_duration(_tier text)
RETURNS interval
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _tier
    WHEN 'city' THEN interval '12 hours'
    WHEN 'regional' THEN interval '24 hours'
    WHEN 'national' THEN interval '48 hours'
    WHEN 'world' THEN interval '72 hours'
    ELSE interval '24 hours' END
$$;
