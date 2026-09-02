INSERT INTO public.billing_settings (provider, product_name, offer_name, price_cents, checkout_url, environment)
VALUES ('kiwify', 'PressBrief — Acesso Fundador', 'Pagamento único', 29700, 'https://pay.kiwify.com.br/8pYbV63', 'production')
ON CONFLICT (provider) DO UPDATE
SET product_name = COALESCE(public.billing_settings.product_name, EXCLUDED.product_name),
    checkout_url = COALESCE(public.billing_settings.checkout_url, EXCLUDED.checkout_url),
    price_cents = COALESCE(public.billing_settings.price_cents, EXCLUDED.price_cents);