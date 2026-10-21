-- Sıfır gönderimde şantiye depo yöneticisinin talebini "depoda mevcut değil" yapma.
-- Son durumu istemci yazar: satın almaya gönderildi.

CREATE OR REPLACE FUNCTION public.update_purchase_request_status_on_shipment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_purchase_request_id UUID;
    v_total_shipped DECIMAL(15,3);
    v_total_original DECIMAL(15,3);
    v_new_status TEXT;
    v_current_status TEXT;
    v_direct_to_purchasing BOOLEAN;
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
        SELECT EXISTS (
            SELECT 1
            FROM purchase_requests pr
            JOIN profiles p ON p.id = pr.requested_by
            WHERE pr.id = v_purchase_request_id
              AND p.role::text = 'santiye_depo_yonetici'
              AND pr.site_id IN (
                'e8e66dc0-108a-463e-b461-b6d5b08d3beb',
                '05d5597a-8c36-4cf8-bf38-eabd3f2c081e',
                'f3ca5e01-2260-4a5b-b861-72ccf3fc2b15',
                'c9c2a77e-369d-4299-baf2-c52c3d69fbd3',
                '59485505-e1d7-4756-ad96-6e8e6a47155d',
                'b99e2366-82c5-43a4-9b0f-9e8b90a22f6c'
              )
        ) INTO v_direct_to_purchasing;

        IF public.shipment_may_rewrite_request_status(v_current_status) AND NOT v_direct_to_purchasing THEN
            UPDATE purchase_requests
            SET status = 'depoda mevcut değil', updated_at = NOW()
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
    SET status = v_new_status, updated_at = NOW()
    WHERE id = v_purchase_request_id;

    RETURN NEW;
END;
$function$;
