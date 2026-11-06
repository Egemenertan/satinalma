// Linasoft API yoklama aracı (salt okuma). Kullanım:
//   node scripts/linasoft-probe.mjs                      -> giriş + swagger yol listesi
//   node scripts/linasoft-probe.mjs <yol> '<json-govde>' -> verilen endpoint'e POST atar
// Kimlik bilgileri .env.local içinden okunur; token ve şifre ekrana yazılmaz.
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const base = (process.env.LINASOFT_BASE_URL || 'https://disservis.linasoft.com.tr:1519').replace(/\/+$/, '')

const loginRes = await fetch(`${base}/LinaDisServisApi/Menu/Giris`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    LisansKodu: process.env.LINASOFT_LISANS_KODU,
    ApiKullanici: process.env.LINASOFT_API_KULLANICI,
    ApiSifre: process.env.LINASOFT_API_SIFRE,
  },
  body: '{}',
})
const loginText = await loginRes.text()
console.log('Giris HTTP', loginRes.status)
let parsed
try { parsed = JSON.parse(loginText) } catch { parsed = loginText }
// Yapıyı göster, değerleri maskele
const mask = (v) => (typeof v === 'string' ? `<string:${v.length}>` : Array.isArray(v) ? v.map(mask) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x)])) : v)
console.log('Giris yanıt yapısı:', JSON.stringify(mask(parsed)))

const find = (o) => (typeof o === 'string' ? o : o && typeof o === 'object' ? Object.values(o).map(find).find(Boolean) : null)
const token = (typeof parsed === 'string' ? parsed : find(parsed))?.replace(/^Bearer\s+/i, '')
if (!token) process.exit(1)
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

const [path, body] = process.argv.slice(2)
if (path) {
  const res = await fetch(`${base}/${path.replace(/^\/+/, '')}`, { method: 'POST', headers: auth, body: body || '{}' })
  const text = await res.text()
  console.log('HTTP', res.status)
  console.log(text.slice(0, 4000))
} else {
  const sw = await fetch(`${base}/swagger/v1/swagger.json`, { headers: auth })
  console.log('swagger.json HTTP', sw.status)
  if (sw.ok) {
    const spec = await sw.json()
    for (const [p, ops] of Object.entries(spec.paths || {})) console.log(Object.keys(ops).join(',').toUpperCase(), p)
  }
}
