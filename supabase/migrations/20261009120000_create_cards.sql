CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  provider TEXT NOT NULL CHECK (length(trim(provider)) > 0),
  card_type TEXT NOT NULL DEFAULT 'debit' CHECK (length(trim(card_type)) > 0),
  network TEXT,
  priority INTEGER NOT NULL CHECK (priority > 0),
  primary_use TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cards_id_user_id_unique UNIQUE (id, user_id),
  CONSTRAINT cards_user_priority_unique UNIQUE (user_id, priority)
);

CREATE TABLE public.card_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID NOT NULL,
  service_name TEXT NOT NULL CHECK (length(trim(service_name)) > 0),
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  billing_frequency TEXT NOT NULL CHECK (length(trim(billing_frequency)) > 0),
  start_date DATE,
  next_billing_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (length(trim(status)) > 0),
  is_free_trial BOOLEAN NOT NULL DEFAULT false,
  trial_start_date DATE,
  trial_end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT card_subscriptions_card_owner_fkey
    FOREIGN KEY (card_id, user_id)
    REFERENCES public.cards (id, user_id)
    ON DELETE CASCADE
);

CREATE TABLE public.card_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID NOT NULL,
  merchant TEXT NOT NULL CHECK (length(trim(merchant)) > 0),
  item_description TEXT NOT NULL CHECK (length(trim(item_description)) > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_type TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT card_purchases_card_owner_fkey
    FOREIGN KEY (card_id, user_id)
    REFERENCES public.cards (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX card_subscriptions_user_card_idx
  ON public.card_subscriptions (user_id, card_id, next_billing_date);
CREATE INDEX card_purchases_user_card_date_idx
  ON public.card_purchases (user_id, card_id, purchase_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_purchases TO authenticated;
GRANT ALL ON public.cards TO service_role;
GRANT ALL ON public.card_subscriptions TO service_role;
GRANT ALL ON public.card_purchases TO service_role;

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cards select"
  ON public.cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own cards insert"
  ON public.cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own cards update"
  ON public.cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own cards delete"
  ON public.cards FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own card subscriptions select"
  ON public.card_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own card subscriptions insert"
  ON public.card_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own card subscriptions update"
  ON public.card_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own card subscriptions delete"
  ON public.card_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own card purchases select"
  ON public.card_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own card purchases insert"
  ON public.card_purchases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own card purchases update"
  ON public.card_purchases FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own card purchases delete"
  ON public.card_purchases FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER card_subscriptions_set_updated_at
  BEFORE UPDATE ON public.card_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER card_purchases_set_updated_at
  BEFORE UPDATE ON public.card_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
