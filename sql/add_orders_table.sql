-- Create orders table
create table if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  purchase_request_id uuid references purchase_requests(id) not null,
  supplier_id uuid references suppliers(id) not null,
  delivery_date date not null,
  amount decimal(12,2) not null,
  currency text not null,
  document_urls text[] default array[]::text[],
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table orders enable row level security;

create policy "Orders are viewable by authenticated users"
  on orders for select
  using (auth.role() = 'authenticated');

create policy "Orders are insertable by authenticated users"
  on orders for insert
  with check (auth.role() = 'authenticated');

create policy "Orders are updatable by authenticated users"
  on orders for update
  using (auth.role() = 'authenticated');

-- Create trigger to update updated_at
create trigger handle_updated_at before update on orders
  for each row execute procedure moddatetime (updated_at);

