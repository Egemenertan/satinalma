-- Drop existing policies
drop policy if exists "Orders are viewable by authenticated users" on orders;
drop policy if exists "Orders are insertable by authenticated users" on orders;
drop policy if exists "Orders are updatable by authenticated users" on orders;

-- Create new policies that check user's role and site access
create policy "Orders are viewable by users with site access"
  on orders for select
  using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from purchase_requests pr
      where pr.id = orders.purchase_request_id
      and exists (
        select 1 from user_sites us
        where us.user_id = auth.uid()
        and us.site_id = pr.site_id
      )
    )
  );

create policy "Orders are insertable by users with site access"
  on orders for insert
  with check (
    auth.role() = 'authenticated' and
    exists (
      select 1 from purchase_requests pr
      where pr.id = purchase_request_id
      and exists (
        select 1 from user_sites us
        where us.user_id = auth.uid()
        and us.site_id = pr.site_id
      )
    )
  );

create policy "Orders are updatable by users with site access"
  on orders for update
  using (
    auth.role() = 'authenticated' and
    exists (
      select 1 from purchase_requests pr
      where pr.id = orders.purchase_request_id
      and exists (
        select 1 from user_sites us
        where us.user_id = auth.uid()
        and us.site_id = pr.site_id
      )
    )
  );

-- Add index for better join performance
create index if not exists idx_orders_purchase_request_id 
  on orders(purchase_request_id);

-- Add index for supplier queries
create index if not exists idx_orders_supplier_id 
  on orders(supplier_id);
