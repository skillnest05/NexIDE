-- user_credits: per-user token wallet
CREATE TABLE IF NOT EXISTS public.user_credits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance BIGINT NOT NULL DEFAULT 0,
    lifetime_purchased BIGINT NOT NULL DEFAULT 0,
    lifetime_used BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can SELECT own row only" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);

-- token_purchases: purchase audit trail
CREATE TABLE IF NOT EXISTS public.token_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tokens BIGINT NOT NULL,
    amount_paise INT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.token_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can SELECT own rows only" ON public.token_purchases FOR SELECT USING (auth.uid() = user_id);

-- token_usage: per-request usage log
CREATE TABLE IF NOT EXISTS public.token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    input_tokens INT NOT NULL,
    output_tokens INT NOT NULL,
    total_tokens INT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_usage_user_id_created_at_idx ON public.token_usage(user_id, created_at DESC);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can SELECT own rows only" ON public.token_usage FOR SELECT USING (auth.uid() = user_id);

-- Trigger: auto-create user_credits row with 1000 free tokens on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (new.id, 1000);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_credits();
