-- Quantity Update Function - Satın Alma Sistemi
-- Bu fonksiyon purchase_request_items tablosundaki miktarları günceller

CREATE OR REPLACE FUNCTION update_purchase_request_item_quantity(
    item_id UUID,
    new_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    old_quantity INTEGER;
    request_id UUID;
BEGIN
    -- Mevcut miktarı ve request_id'yi al
    SELECT quantity, purchase_request_id INTO old_quantity, request_id
    FROM purchase_request_items 
    WHERE id = item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase request item not found with id: %', item_id;
    END IF;
    
    -- Miktarı güncelle
    UPDATE purchase_request_items 
    SET 
        quantity = new_quantity,
        updated_at = NOW()
    WHERE id = item_id;
    
    -- Log oluştur
    RAISE NOTICE 'Item % quantity updated: % -> %', item_id, old_quantity, new_quantity;
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update quantity: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yetkiler
GRANT EXECUTE ON FUNCTION update_purchase_request_item_quantity(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION update_purchase_request_item_quantity(UUID, INTEGER) IS 'Güvenli miktar güncelleme fonksiyonu';