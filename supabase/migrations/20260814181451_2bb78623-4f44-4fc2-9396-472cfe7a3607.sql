alter table public.news_items drop constraint if exists news_items_url_key;
drop index if exists public.news_items_url_key;
create unique index news_items_user_url_key on public.news_items(user_id, url);