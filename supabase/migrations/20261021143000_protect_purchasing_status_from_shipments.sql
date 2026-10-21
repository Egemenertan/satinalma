-- Shipment insert/update/delete must not rewind a request that already left the warehouse path
-- (satın almaya gönderildi, IT, sipariş, teslim). Qty=0 "depoda yok" rows were overwriting purchasing.

CREATE OR REPLACE FUNCTION public.shipment_may_rewrite_request_status(current_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(current_status, '')) IN (
    'pending',
    'onay_bekliyor',
    'awaiting_offers',
    'kısmen gönderildi',
    'depoda mevcut değil',
    'ana depoda yok',
    'bekliyor',
    'beklemede'
  );
$$;

REVOKE ALL ON FUNCTION public.shipment_may_rewrite_request_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shipment_may_rewrite_request_status(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_purchase_request_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    total_requested DECIMAL := 0;
    total_shipped DECIMAL := 0;
    request_id UUID;
    new_status TEXT;
    current_status TEXT;
BEGIN
    IF TG_TABLE_NAME = 'orders' AND TG_OP = 'INSERT' THEN
        UPDATE purchase_requests
        SET
            status = 'sipariş verildi',
            updated_at = NOW()
        WHERE id = NEW.purchase_request_id;
        RAISE NOTICE 'Sipariş verildi, status güncellendi: %', NEW.purchase_request_id;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'orders' AND TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE purchase_requests
        SET
            status = 'teslim alındı',
            updated_at = NOW()
        WHERE id = NEW.purchase_request_id;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'shipments' AND TG_OP = 'INSERT' THEN
        request_id := NEW.purchase_request_id;

        SELECT status INTO current_status
        FROM purchase_requests
        WHERE id = request_id;

        IF NOT public.shipment_may_rewrite_request_status(current_status) THEN
            RETURN NEW;
        END IF;

        SELECT COALESCE(SUM(quantity), 0) INTO total_requested
        FROM purchase_request_items
        WHERE purchase_request_id = request_id;

        SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_shipped
        FROM shipments
        WHERE purchase_request_id = request_id;

        IF total_shipped >= total_requested AND total_requested > 0 THEN
            new_status := 'gönderildi';
        ELSIF total_shipped > 0 THEN
            new_status := 'kısmen gönderildi';
        ELSE
            new_status := 'bekliyor';
        END IF;

        UPDATE purchase_requests
        SET
            status = new_status,
            updated_at = NOW()
        WHERE id = request_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_purchase_request_status_on_shipment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_purchase_request_id UUID;
    v_total_shipped DECIMAL(15,3);
    v_total_original DECIMAL(15,3);
    v_new_status TEXT;
    v_current_status TEXT;
BEGIN
    SELECT purchase_request_id INTO v_purchase_request_id
    FROM purchase_request_items
    WHERE id = NEW.purchase_request_item_id;

    IF v_purchase_request_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status INTO v_current_status
    FROM purchase_requests
    WHERE id = v_purchase_request_id;

    IF NEW.shipped_quantity = 0 THEN
        IF public.shipment_may_rewrite_request_status(v_current_status) THEN
            UPDATE purchase_requests
            SET
                status = 'depoda mevcut değil',
                updated_at = NOW()
            WHERE id = v_purchase_request_id;
        END IF;

        RETURN NEW;
    END IF;

    UPDATE purchase_request_items
    SET
        sent_quantity = COALESCE(sent_quantity, 0) + NEW.shipped_quantity,
        updated_at = NOW()
    WHERE id = NEW.purchase_request_item_id;

    IF NOT public.shipment_may_rewrite_request_status(v_current_status) THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(pri.sent_quantity), 0) INTO v_total_shipped
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = v_purchase_request_id;

    SELECT COALESCE(SUM(COALESCE(pri.original_quantity, pri.quantity)), 0) INTO v_total_original
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = v_purchase_request_id;

    IF v_total_shipped >= v_total_original THEN
        v_new_status := 'gönderildi';
    ELSIF v_total_shipped > 0 THEN
        v_new_status := 'kısmen gönderildi';
    ELSE
        RETURN NEW;
    END IF;

    UPDATE purchase_requests
    SET
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_purchase_request_id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_purchase_request_status_on_shipment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_purchase_request_id UUID;
    v_total_shipped DECIMAL(15,3);
    v_total_original DECIMAL(15,3);
    v_new_status TEXT;
    v_quantity_diff DECIMAL(15,3);
    v_current_status TEXT;
BEGIN
    SELECT purchase_request_id INTO v_purchase_request_id
    FROM purchase_request_items
    WHERE id = NEW.purchase_request_item_id;

    IF v_purchase_request_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_quantity_diff := NEW.shipped_quantity - OLD.shipped_quantity;

    UPDATE purchase_request_items
    SET
        sent_quantity = COALESCE(sent_quantity, 0) + v_quantity_diff,
        updated_at = NOW()
    WHERE id = NEW.purchase_request_item_id;

    SELECT status INTO v_current_status
    FROM purchase_requests
    WHERE id = v_purchase_request_id;

    IF NOT public.shipment_may_rewrite_request_status(v_current_status) THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(pri.sent_quantity), 0) INTO v_total_shipped
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = v_purchase_request_id;

    SELECT COALESCE(SUM(COALESCE(pri.original_quantity, pri.quantity)), 0) INTO v_total_original
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = v_purchase_request_id;

    IF v_total_shipped >= v_total_original THEN
        v_new_status := 'gönderildi';
    ELSIF v_total_shipped > 0 THEN
        v_new_status := 'kısmen gönderildi';
    ELSE
        v_new_status := 'sipariş verildi';
    END IF;

    UPDATE purchase_requests
    SET
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_purchase_request_id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_purchase_request_status_on_shipment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_purchase_request_id UUID;
    v_total_shipped DECIMAL(15,3);
    v_total_original DECIMAL(15,3);
    v_new_status TEXT;
    v_current_status TEXT;
BEGIN
    SELECT purchase_request_id INTO v_purchase_request_id
    FROM purchase_request_items
    WHERE id = OLD.purchase_request_item_id;

    IF v_purchase_request_id IS NULL THEN
        RETURN OLD;
    END IF;

    UPDATE purchase_request_items
    SET
        sent_quantity = GREATEST(COALESCE(sent_quantity, 0) - OLD.shipped_quantity, 0),
        updated_at = NOW()
    WHERE id = OLD.purchase_request_item_id;

    SELECT status INTO v_current_status
    FROM purchase_requests
    WHERE id = v_purchase_request_id;

    IF NOT public.shipment_may_rewrite_request_status(v_current_status) THEN
        RETURN OLD;
    END IF;

    SELECT COALESCE(SUM(pri.sent_quantity), 0) INTO v_total_shipped
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = v_purchase_request_id;

    SELECT COALESCE(SUM(COALESCE(pri.original_quantity, pri.quantity)), 0) INTO v_total_original
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = v_purchase_request_id;

    IF v_total_shipped >= v_total_original THEN
        v_new_status := 'gönderildi';
    ELSIF v_total_shipped > 0 THEN
        v_new_status := 'kısmen gönderildi';
    ELSE
        v_new_status := 'sipariş verildi';
    END IF;

    UPDATE purchase_requests
    SET
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_purchase_request_id;

    RETURN OLD;
END;
$function$;
