// SMTP Test Script
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testSMTP() {
  console.log('🔍 SMTP Ayarları Test Ediliyor...\n');
  
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    },
    debug: true, // Detaylı log
    logger: true // Logger aktif
  };

  console.log('📧 Kullanılan Ayarlar:');
  console.log('  Host:', config.host);
  console.log('  Port:', config.port);
  console.log('  Secure:', config.secure);
  console.log('  User:', config.auth.user);
  console.log('  Pass:', config.auth.pass ? '****' + config.auth.pass.slice(-4) : 'YOK');
  console.log('\n');

  const transporter = nodemailer.createTransport(config);

  try {
    console.log('🔌 SMTP sunucusuna bağlanılıyor...\n');
    await transporter.verify();
    console.log('\n✅ SMTP bağlantısı başarılı!');
    console.log('✅ Email göndermeye hazır!\n');
    
    // Test email gönder
    console.log('📤 Test email gönderiliyor...\n');
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || config.auth.user,
      to: config.auth.user, // Kendine gönder
      subject: '🧪 SMTP Test - Başarılı!',
      text: 'Bu bir test emailidir. SMTP ayarlarınız doğru çalışıyor!',
      html: '<h1>✅ Test Başarılı!</h1><p>SMTP ayarlarınız doğru çalışıyor!</p>'
    });
    
    console.log('✅ Email başarıyla gönderildi!');
    console.log('📧 Message ID:', info.messageId);
    console.log('\n🎉 Tüm testler başarılı! Email sistemi hazır.\n');
    
  } catch (error) {
    console.error('\n❌ HATA:', error.message);
    console.error('\n🔍 Detaylı Hata:', error);
    
    console.log('\n💡 Çözüm Önerileri:');
    
    if (error.message.includes('authentication') || error.message.includes('Invalid login')) {
      console.log('  1. Şifreniz yanlış olabilir');
      console.log('  2. 2 Adımlı Doğrulama varsa App Password gerekir');
      console.log('  3. Modern Authentication kapalı olabilir');
    }
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.log('  1. Port numarasını değiştirin (587 → 25 veya 465)');
      console.log('  2. Firewall SMTP\'yi engelliyor olabilir');
      console.log('  3. VPN kullanıyorsanız kapatıp deneyin');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('  1. SMTP sunucu adresi yanlış olabilir');
      console.log('  2. Port numarası yanlış olabilir');
    }
    
    console.log('\n');
    process.exit(1);
  }
}

testSMTP();
