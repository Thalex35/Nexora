ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS priorities TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.daily_plans
SET priorities = array_remove(ARRAY[priority_1, priority_2, priority_3], NULL::text)
WHERE COALESCE(cardinality(priorities), 0) = 0
  AND (priority_1 IS NOT NULL OR priority_2 IS NOT NULL OR priority_3 IS NOT NULL);

UPDATE public.daily_plans
SET priorities = '{}'
WHERE priorities IS NULL;

ALTER TABLE public.daily_plans
  ALTER COLUMN priorities SET DEFAULT '{}',
  ALTER COLUMN priorities SET NOT NULL;
