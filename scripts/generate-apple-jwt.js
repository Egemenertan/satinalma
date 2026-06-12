const jwt = require('jsonwebtoken');

const privateKey = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgn+BamKFueTV3M0Y2
XdNAw4AtsUO+IIkQ59xaECIuODigCgYIKoZIzj0DAQehRANCAAR6mQf3GpENS8lm
C0wM4O3qWliMaUQg1YDE3+lwbS6LBKMljCzg7xyWf7Xktp4uaWK4yh2YRrwanisG
WRfxd+c0
-----END PRIVATE KEY-----`;

const teamId = '592QQ45TLH';
const clientId = 'com.dlx';
const keyId = 'QYXX6263U2';

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  audience: 'https://appleid.apple.com',
  issuer: teamId,
  subject: clientId,
  keyid: keyId,
});

console.log('\n=== SUPABASE SECRET KEY ===\n');
console.log(token);
console.log('\n===========================\n');
