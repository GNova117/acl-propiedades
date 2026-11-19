-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────

alter table zones enable row level security;
alter table advisors enable row level security;
alter table properties enable row level security;
alter table property_advisors enable row level security;
alter table contact_messages enable row level security;

-- Public (anon) read access
create policy "Public can read zones" on zones for select using (true);
create policy "Public can read active advisors" on advisors for select using (true);
create policy "Public can read active properties" on properties for select using (true);
create policy "Public can read property_advisors" on property_advisors for select using (true);

-- Public can submit contact messages, but not read them back
create policy "Public can insert contact messages" on contact_messages for insert with check (true);

-- Authenticated admin: full read/write on everything
create policy "Authenticated manage zones" on zones for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated manage advisors" on advisors for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated manage properties" on properties for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated manage property_advisors" on property_advisors for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated read contact messages" on contact_messages for select using (auth.role() = 'authenticated');

