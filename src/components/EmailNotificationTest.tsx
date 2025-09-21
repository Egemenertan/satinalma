'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, CheckCircle, XCircle, Clock } from 'lucide-react';

export function EmailNotificationTest() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const testEmailService = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // First test connection
      const connectionResponse = await fetch('/api/email/send', {
        method: 'GET'
      });
      
      const connectionData = await connectionResponse.json();
      console.log('Connection test:', connectionData);

      // Then send test email
      const testResponse = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await testResponse.json();
      
      if (testResponse.ok) {
        setTestResult({
          success: true,
          message: result.message,
          email: result.email,
          messageId: result.messageId,
          service: result.service,
          connection: connectionData
        });
      } else {
        setTestResult({
          success: false,
          error: result.error,
          connection: connectionData
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        connection: null
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          E-posta Bildirim Testi
        </CardTitle>
        <CardDescription>
          E-posta servisini test edin ve kendinize test e-postası gönderin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testEmailService} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Test E-postası Gönderiliyor...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Test E-postası Gönder
            </>
          )}
        </Button>

        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`font-medium ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.success ? 'Test Başarılı!' : 'Test Başarısız'}
                </h3>
                
                {testResult.success ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-green-700 text-sm">
                      {testResult.message}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <strong>E-posta:</strong> {testResult.email}
                      </div>
                      <div>
                        <strong>Servis:</strong> {testResult.service}
                      </div>
                      {testResult.messageId && (
                        <div className="sm:col-span-2">
                          <strong>Message ID:</strong> {testResult.messageId}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-red-700 text-sm mt-2">
                    Hata: {testResult.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-2">
          <div className="border-t pt-3">
            <h4 className="font-medium text-gray-700 mb-2">💡 E-posta Ayarları:</h4>
            <div className="space-y-1">
              <p><strong>Development:</strong> Ethereal Email (test) - e-postalar gerçek gönderilmez</p>
              <p><strong>Production:</strong> Gmail SMTP veya diğer SMTP servisleri</p>
              <p><strong>Gerekli ENV değişkenleri:</strong></p>
              <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                SMTP_HOST=smtp.gmail.com<br/>
                SMTP_PORT=587<br/>
                SMTP_USER=your-email@gmail.com<br/>
                SMTP_PASS=your-app-password<br/>
                SMTP_FROM="Satın Alma Sistemi" &lt;noreply@yourcompany.com&gt;
              </div>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <h4 className="font-medium text-gray-700 mb-2">📧 E-posta Türleri:</h4>
            <ul className="space-y-1">
              <li>• 🆕 Yeni talep oluşturulduğunda</li>
              <li>• 🔄 Talep durumu değiştiğinde</li>
              <li>• 💰 Yeni teklif geldiğinde</li>
              <li>• ✅ Teklif kabul/red edildiğinde</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
