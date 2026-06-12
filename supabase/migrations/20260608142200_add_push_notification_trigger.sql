-- Push Notification Trigger Migration
-- Uygulama kapalıyken bile push bildirimi göndermek için pg_net kullanır

-- pg_net extension'ı etkinleştir
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Push notification gönderen trigger function
CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token RECORD;
    v_messages JSONB := '[]'::jsonb;
    v_request_id BIGINT;
BEGIN
    -- Kullanıcının push token'larını al
    FOR v_token IN 
        SELECT expo_push_token, platform 
        FROM expo_push_tokens 
        WHERE user_id = NEW.user_id 
        AND expo_push_token LIKE 'ExponentPushToken%'
    LOOP
        v_messages := v_messages || jsonb_build_object(
            'to', v_token.expo_push_token,
            'title', COALESCE(NEW.title, 'Satın Alma'),
            'body', COALESCE(NEW.message, ''),
            'sound', 'default',
            'priority', 'high',
            'channelId', 'satinalma_alerts_v1',
            'data', jsonb_build_object(
                'notificationId', NEW.id::text,
                'type', NEW.type,
                'referenceType', NEW.reference_type,
                'referenceId', NEW.reference_id::text
            )
        );
    END LOOP;

    -- Eğer token varsa Expo Push API'ye gönder
    IF jsonb_array_length(v_messages) > 0 THEN
        SELECT net.http_post(
            url := 'https://exp.host/--/api/v2/push/send',
            body := v_messages,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Accept', 'application/json'
            )
        ) INTO v_request_id;
        
        RAISE NOTICE 'Push notification sent to % devices, request_id: %', jsonb_array_length(v_messages), v_request_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Hata olursa loglama yap ama işlemi engelleme
    RAISE WARNING 'Push notification error: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Mevcut trigger varsa kaldır
DROP TRIGGER IF EXISTS trigger_send_push_notification ON notifications;

-- Notifications tablosuna INSERT olduğunda push bildirimi gönder
CREATE TRIGGER trigger_send_push_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION send_push_notification_on_insert();

-- Yorum: Bu trigger, notifications tablosuna yeni kayıt eklendiğinde
-- otomatik olarak Expo Push API'ye istek gönderir.
-- Uygulama kapalı olsa bile bildirim cihaza ulaşır.
