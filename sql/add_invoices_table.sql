-- Create invoices table for storing invoice data
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    invoice_photos TEXT[] DEFAULT array[]::text[],
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoices are viewable by authenticated users"
    ON public.invoices FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Invoices are insertable by authenticated users"
    ON public.invoices FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Invoices are updatable by authenticated users"
    ON public.invoices FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON public.invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.invoices IS 'Stores invoice information for orders';
COMMENT ON COLUMN public.invoices.order_id IS 'Reference to the order this invoice belongs to';
COMMENT ON COLUMN public.invoices.amount IS 'Invoice amount';
COMMENT ON COLUMN public.invoices.currency IS 'Currency of the invoice amount';
COMMENT ON COLUMN public.invoices.invoice_photos IS 'Array of photo URLs for invoice documents';
