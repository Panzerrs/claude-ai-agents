import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Canli, Durum, Kadro, Kayit, Yuruyus } from '../types'

const PANE = 'ajan-ofisi'
const BASLIK = 'Ajan Ofisi'
const BOS_DURUM: Durum = { ajanlar: {}, kayit: [] }
const BOS_YURUYUS: Yuruyus = {}
const BOS_CANLI: Canli = {}
const BOS_KAYIT: Kayit[] = []

// Motorun olaylarından (alt ajan başlatma, araç çağrısı, tur sonu) kendiliğinden
// izlenen durum: elle yazılan ofis/durum.json'ın üstüne biner.
const canliAtom = atom({ plugin: 'ajan-ofisi', key: 'canli' } as const, BOS_CANLI, {
  shape: 'canli-1',
})
const otoKayitAtom = atom({ plugin: 'ajan-ofisi', key: 'otoKayit' } as const, BOS_KAYIT, {
  shape: 'otokayit-1',
})

const kadroAtom = atom({ plugin: 'ajan-ofisi', key: 'kadro' } as const, null, {
  shape: 'kadro-1',
})
const durumAtom = atom({ plugin: 'ajan-ofisi', key: 'durum' } as const, BOS_DURUM, {
  shape: 'durum-1',
})
const yuruyusAtom = atom({ plugin: 'ajan-ofisi', key: 'yuruyus' } as const, BOS_YURUYUS, {
  shape: 'yuruyus-2',
})

// ---- ofis haritası (SVG), dar panele göre dikey yerleşim ----
// Hareket SVG'nin kendi animasyonlarıyla (SMIL) oynar: harita yalnızca durum
// değiştiğinde yeniden çizilir, arada yüzey animasyonu kendisi yürütür.
const W = 272
const KORIDOR_X = 17
const ZIYARET_Y = 74
const MUDUR = { x: 136, y: 46 }
const HIZ = 95 // piksel/saniye
const BEKLE = 1.5 // müdürün önünde bekleme, saniye
const ETIKET: Record<string, string> = { bosta: 'boşta', calisiyor: 'çalışıyor', bitti: 'teslim etti' }
const DEP_RENK = ['#4f7bd9', '#9a5fd0', '#e0823a', '#3aa876', '#d0507a', '#3a9db0']
const TEN = ['#f3c9a4', '#e2ab82', '#c98d62', '#a56a44', '#f7d9bd']
const SAC = ['#2a2019', '#5a3a1e', '#8a5a2b', '#c9a24b', '#1c1c24', '#7a2f22', '#6b6b74']

type Kisi = {
  id: string
  ad: string
  unvan: string
  renk: string
  mudur: boolean
  x: number
  y: number
  hal: string
  gorev: string
}

/** Süren bir yürüyüş: yolun noktaları, toplam süresi ve bitmesine kalan saniye. */
type Yuruyen = {
  degerler: string
  zamanlar: string
  sure: number
  gecen: number
  kalan: number
  /** Hedefin yanında beklemenin başladığı ve bittiği an, şu andan saniye olarak (geçmişse eksi). */
  beklemeBas: number
  beklemeBit: number
}

function karma(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0

  return h
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function r(x: number, y: number, w: number, h: number, fill: string, ek = ''): string {
  return `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${w}" height="${h}" fill="${fill}"${ek}/>`
}

function yazi(x: number, y: number, metin: string, boy: number, fill: string, hiza = 'middle', kalin = false): string {
  return `<text x="${x}" y="${y}" font-size="${boy}" text-anchor="${hiza}" fill="${fill}"${kalin ? ' font-weight="bold"' : ''}>${esc(metin)}</text>`
}

function kisiler(kadro: Kadro, durum: Durum, canli: Canli): { liste: Kisi[]; departmanlar: { ad: string; renk: string; sy: number }[] } {
  const liste: Kisi[] = []
  const halOf = (id: string) => {
    // Kendiliğinden izlenen canlı durum varsa o geçerlidir; yoksa dosyadaki.
    const c = canli[id]
    if (c) return { hal: c.durum, gorev: c.gorev + (c.durum === 'calisiyor' && c.arac ? ` (${c.arac})` : '') }
    const k = durum.ajanlar?.[id] ?? {}
    const hal = k.durum && ETIKET[k.durum] ? k.durum : 'bosta'

    return { hal, gorev: k.gorev ?? '' }
  }
  const m = kadro.mudur
  liste.push({ id: m.id, ad: m.ad, unvan: m.unvan, renk: '#2d3142', mudur: true, x: MUDUR.x, y: MUDUR.y, ...halOf(m.id) })
  const departmanlar = kadro.departmanlar.map((d, i) => {
    const sy = 150 + i * 76
    const renk = DEP_RENK[i % DEP_RENK.length] ?? '#4f7bd9'
    const adim = 236 / Math.max(d.ajanlar.length, 1)
    d.ajanlar.forEach((a, j) => {
      liste.push({ id: a.id, ad: a.ad, unvan: a.unvan, renk, mudur: false, x: Math.round(28 + adim * (j + 0.5)), y: sy, ...halOf(a.id) })
    })

    return { ad: d.ad, renk, sy }
  })

  return { liste, departmanlar }
}

/**
 * Masadan hedefe gidip dönen yol; `gecen` saniye önce başladıysa ve sürüyorsa döner.
 * Hedef yoksa müdürün önüne, varsa o ajanın masasının arkasındaki geçide gidilir.
 */
function yuruyen(a: Kisi, gecen: number, hedef?: Kisi): Yuruyen | undefined {
  if (gecen < 0) return undefined
  let gidis: [number, number][]
  if (hedef && !hedef.mudur && hedef.id !== a.id) {
    const hx = hedef.x + 10 - a.x
    const hy = hedef.y - 26 - a.y
    gidis =
      hedef.y === a.y
        ? [[0, 0], [0, -26], [hx, -26]]
        : [[0, 0], [0, -26], [KORIDOR_X - a.x, -26], [KORIDOR_X - a.x, hy], [hx, hy]]
  } else {
    const vx = MUDUR.x + ((karma(a.id) % 5) - 2) * 13
    gidis = [
      [0, 0],
      [0, -26],
      [KORIDOR_X - a.x, -26],
      [KORIDOR_X - a.x, ZIYARET_Y - a.y],
      [vx - a.x, ZIYARET_Y - a.y],
    ]
  }
  const son = gidis[gidis.length - 1] as [number, number]
  const noktalar = [...gidis, son, ...[...gidis].reverse().slice(1)]
  const anlar = [0]
  for (let i = 1; i < noktalar.length; i++) {
    const p = noktalar[i - 1] as [number, number]
    const q = noktalar[i] as [number, number]
    const mesafe = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])
    anlar.push((anlar[i - 1] as number) + (mesafe === 0 ? BEKLE : mesafe / HIZ))
  }
  const sure = anlar[anlar.length - 1] as number
  if (gecen >= sure) return undefined

  return {
    degerler: noktalar.map(p => `${p[0]},${p[1]}`).join(';'),
    zamanlar: anlar.map(t => (t / sure).toFixed(4)).join(';'),
    sure,
    gecen,
    kalan: sure - gecen,
    beklemeBas: (anlar[gidis.length - 1] as number) - gecen,
    beklemeBit: (anlar[gidis.length] as number) - gecen,
  }
}

function kisiCiz(a: Kisi, yur: Yuruyen | undefined): string {
  const h = karma(a.id)
  const ten = TEN[h % TEN.length] ?? '#f3c9a4'
  const sac = SAC[(h >> 3) % SAC.length] ?? '#2a2019'
  const uzun = (h >> 7) % 2 === 0
  const { x, y } = a
  const kalan = yur ? yur.kalan.toFixed(2) : '0'
  // bacaklar: yürürken sırayla kalkar, yürüyüş bitince durur
  const adim = (gecikme: number) =>
    yur ? `<animate attributeName="height" values="5;2;5" dur="0.3s" begin="${gecikme}s" end="${kalan}s" repeatCount="indefinite"/>` : ''
  let s = `<rect x="${x - 4}" y="${y + 1}" width="3" height="5" fill="#2b2b3a">${adim(0)}</rect>`
  s += `<rect x="${x + 1}" y="${y + 1}" width="3" height="5" fill="#2b2b3a">${adim(0.15)}</rect>`
  s += r(x - 5, y - 7, 10, 8, a.renk) + r(x - 5, y - 1, 10, 2, '#000', ' opacity=".18"')
  if (a.mudur) s += r(x - 2, y - 7, 4, 3, '#f4f4f4') + r(x - 1, y - 6, 2, 5, '#c0392b')
  s += r(x - 6, y - 6, 1, 5, ten) + r(x + 5, y - 6, 1, 5, ten) + r(x - 4, y - 15, 8, 8, ten)
  s += r(x - 4, y - 17, 8, 3, sac) + r(x - 5, y - 16, 1, uzun ? 8 : 4, sac) + r(x + 4, y - 16, 1, uzun ? 8 : 4, sac)
  // gözler: herkes kendi sırasıyla göz kırpar
  const kirp = `<animate attributeName="opacity" values="1;1;0;1" keyTimes="0;0.93;0.96;1" dur="${3 + (h % 5) * 0.5}s" begin="${(h % 30) / 10}s" repeatCount="indefinite"/>`
  s += `<rect x="${x - 2}" y="${y - 11}" width="1" height="2" fill="#1d1d1d">${kirp}</rect>`
  s += `<rect x="${x + 1}" y="${y - 11}" width="1" height="2" fill="#1d1d1d">${kirp}</rect>`
  if (yur) {
    // elindeki kağıt yürüyüş bitince kaybolur
    s += `<g>${r(x + 5, y - 8, 6, 7, '#fffdf2')}${r(x + 6, y - 6, 4, 1, '#888')}${r(x + 6, y - 4, 4, 1, '#888')}<set attributeName="opacity" to="0" begin="${kalan}s" fill="freeze"/></g>`
    // hedefin yanında beklerken konuşma balonu
    s += `<g opacity="0">${r(x - 7, y - 29, 14, 9, '#1b1b22')}${r(x - 6, y - 28, 12, 7, '#fffdf2')}${r(x - 1, y - 20, 2, 2, '#1b1b22')}${r(x - 4, y - 25, 2, 2, '#555')}${r(x - 1, y - 25, 2, 2, '#555')}${r(x + 2, y - 25, 2, 2, '#555')}<set attributeName="opacity" to="1" begin="${yur.beklemeBas.toFixed(2)}s" fill="freeze"/><set attributeName="opacity" to="0" begin="${yur.beklemeBit.toFixed(2)}s" fill="freeze"/></g>`
    s += `<animateTransform attributeName="transform" type="translate" values="${yur.degerler}" keyTimes="${yur.zamanlar}" dur="${yur.sure.toFixed(2)}s" begin="${(-yur.gecen).toFixed(2)}s" fill="freeze"/>`
  }
  if (a.hal === 'calisiyor') {
    // masasındayken yazarak hafifçe sallanır (yürüyorsa dönünce başlar)
    s += `<animateTransform attributeName="transform" type="translate" values="0,0;0,-1;0,0" dur="0.9s" begin="${kalan}s" repeatCount="indefinite"/>`
  }

  return `<g>${s}</g>`
}

function masaCiz(a: Kisi): string {
  const { x, y } = a
  const gen = a.mudur ? 48 : 32
  let s = r(x - gen / 2, y - 1, gen, 14, '#a97c48') + r(x - gen / 2, y - 1, gen, 11, '#c99a63') + r(x - gen / 2, y - 1, gen, 1, '#e0b47c')
  s += r(x + 5, y - 6, 11, 8, '#16181d')
  if (a.hal === 'calisiyor') {
    s += r(x + 6, y - 5, 9, 6, '#12301f')
    for (let i = 0; i < 3; i++) {
      s += `<rect x="${x + 7}" y="${y - 4 + i * 2}" width="3" height="1" fill="#6ee39a"><animate attributeName="width" values="2;7;4;6;2" dur="1.2s" begin="${i * 0.3}s" repeatCount="indefinite"/></rect>`
    }
  } else {
    s += r(x + 6, y - 5, 9, 6, a.hal === 'bitti' ? '#274a7a' : '#2b2f38')
    // boştaki ekranda yanıp sönen imleç
    s += `<rect x="${x + 7}" y="${y - 1}" width="2" height="1" fill="#9aa3b2"><animate attributeName="opacity" values="1;0;1" dur="1.6s" begin="${(karma(a.id) % 16) / 10}s" repeatCount="indefinite"/></rect>`
  }
  s += r(x + 9, y + 2, 3, 2, '#16181d') + r(x - 7, y + 4, 10, 3, '#e9e3d2')
  s += r(x - 15, y + 15, 30, 8, '#000', ' opacity=".55"') + yazi(x, y + 21, a.ad, 6, '#fff')

  return s
}

function balonCiz(a: Kisi, yur: Yuruyen | undefined): string {
  const x = a.x
  const y = a.y - 28
  let s = ''
  if (a.hal === 'calisiyor') {
    s = r(x - 8, y, 16, 9, '#1b1b22') + r(x - 7, y + 1, 14, 7, '#fffdf2') + r(x - 1, y + 9, 2, 2, '#1b1b22')
    for (let i = 0; i < 3; i++) {
      s += `<rect x="${x - 5 + i * 4}" y="${y + 4}" width="2" height="2" fill="#2e9e5b"><animate attributeName="opacity" values="0;1;1;0" dur="1.2s" begin="${i * 0.25}s" repeatCount="indefinite"/></rect>`
    }
  } else if (a.hal === 'bitti') {
    s =
      r(x - 6, y, 12, 9, '#1b1b22') + r(x - 5, y + 1, 10, 7, '#2f6fd0') + r(x - 1, y + 9, 2, 2, '#1b1b22') +
      r(x - 3, y + 4, 1, 2, '#fff') + r(x - 2, y + 5, 1, 2, '#fff') + r(x - 1, y + 4, 1, 2, '#fff') + r(x, y + 3, 1, 2, '#fff') + r(x + 1, y + 2, 1, 2, '#fff')
  }
  if (s === '') return ''
  // yürüyen ajanın balonu masasına dönünce belirir
  if (yur) return `<g opacity="0">${s}<set attributeName="opacity" to="1" begin="${yur.kalan.toFixed(2)}s" fill="freeze"/></g>`

  return s
}

function ofisSvg(kadro: Kadro, durum: Durum, canli: Canli, yuruyus: Yuruyus, simdi: number): { kaynak: string; yukseklik: number } {
  const { liste, departmanlar } = kisiler(kadro, durum, canli)
  const H = 150 + Math.max(departmanlar.length - 1, 0) * 76 + 46
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" font-family="Consolas, 'Courier New', monospace">`
  // Desen ve url() başvurusu kullanılmaz: bazı yüzeyler bunları ayıklar.
  s += r(0, 0, W, H, '#86ae9f')
  for (let x = 16; x < W; x += 16) s += r(x, 0, 1, H, '#7aa193')
  for (let y = 16; y < H; y += 16) s += r(0, y, W, 1, '#7aa193')
  // müdür odası
  s += r(8, 8, W - 16, 80, '#c79a62')
  for (let y = 16; y < 88; y += 16) s += r(8, y, W - 16, 8, '#bf9159')
  s += r(92, 26, 88, 56, '#8e3b3b') + r(96, 30, 80, 48, '#a84848')
  s += r(16, 12, 44, 14, '#6b4a2b')
  const kitap = ['#d9534f', '#f0ad4e', '#5bc0de', '#5cb85c']
  for (let i = 0; i < 7; i++) s += r(19 + i * 6, 14, 4, 10, kitap[i % 4] ?? '#d9534f')
  s += r(212, 14, 44, 12, '#4a5a8a') + r(212, 24, 44, 7, '#5d70ac')
  s += r(244, 72, 8, 6, '#8a5a2b') + r(242, 62, 12, 10, '#2f8f4e') + r(245, 58, 6, 5, '#3fae62')
  s += yazi(MUDUR.x, 20, 'MÜDÜR ODASI', 7, '#3b2a1a', 'middle', true)
  // departman halıları
  for (const d of departmanlar) {
    s += r(26, d.sy - 38, 240, 72, '#000', ' opacity=".18"') + r(28, d.sy - 36, 236, 68, d.renk, ' opacity=".42"')
    s += yazi(31, d.sy - 28, d.ad.toLocaleUpperCase('tr-TR'), 7, '#ffffff', 'start', true)
  }
  // duvarlar, cam bölme (kapı solda koridorda)
  s += r(0, 0, W, 8, '#3b3b4a') + r(0, H - 8, W, 8, '#3b3b4a') + r(0, 0, 8, H, '#3b3b4a') + r(W - 8, 0, 8, H, '#3b3b4a') + r(8, 8, W - 16, 3, '#55556a')
  s += r(28, 88, W - 36, 5, '#3b3b4a') + r(32, 89, W - 44, 3, '#9fd0e0')
  s += r(11, H - 22, 8, 6, '#8a5a2b') + r(9, H - 32, 12, 10, '#2f8f4e') + r(12, H - 36, 6, 5, '#3fae62')

  // Çizim sırası: koltuklar, sonra y'ye göre kişiler ve masalar; yürüyenler en üstte.
  const sirali = [...liste].sort((p, q) => p.y - q.y)
  for (const a of sirali) s += r(a.x - 6, a.y - 12, 12, 12, '#3a3f52') + r(a.x - 5, a.y - 11, 10, 3, '#4d546c')
  let ustte = ''
  for (const a of sirali) {
    const kayit = a.mudur ? undefined : yuruyus[a.id]
    const hedef = kayit?.hedef === undefined ? undefined : liste.find(k => k.id === kayit.hedef)
    const yur = kayit === undefined ? undefined : yuruyen(a, (simdi - kayit.t) / 1000, hedef)
    const ipucu = `<title>${esc(`${a.ad} — ${a.unvan} (${ETIKET[a.hal] ?? a.hal})${a.gorev ? ': ' + a.gorev : ''}`)}</title>`
    if (yur) {
      s += `<g>${ipucu}${masaCiz(a)}${balonCiz(a, yur)}</g>`
      ustte += kisiCiz(a, yur)
    } else {
      s += `<g>${ipucu}${kisiCiz(a, undefined)}${masaCiz(a)}${balonCiz(a, undefined)}</g>`
    }
  }

  return { kaynak: s + ustte + '</svg>', yukseklik: H }
}

// ---- modül ----
let sonKadro = ''
let sonDurum = ''
let oncekiHaller: Record<string, string> | undefined
let sonAktarimNo: number | undefined
let mudurId = 'mudur'
let tik = 0
let sonMudurYazim = 0
const sonAjanYazim: Record<string, number> = {}

function zamanYazi(ms: number): string {
  const d = new Date(ms)
  const iki = (n: number) => String(n).padStart(2, '0')

  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}T${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`
}

function kisalt(s: string, n = 70): string {
  const t = s.replace(/\s+/g, ' ').trim()

  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/** Bir araç çağrısını panoda okunur kısa bir satıra çevirir. */
function aracOzeti(e: unknown): string {
  const g = e as Record<string, unknown>
  const arac = String(g.tool ?? '')
  const kisaAd = arac.startsWith('mcp__') ? (arac.split('__').pop() ?? arac) : arac
  if (arac === 'Agent' && typeof g.description === 'string') return kisalt('Görev veriyor: ' + g.description)
  if (typeof g.description === 'string' && g.description) return kisalt(g.description)
  if (typeof g.file_path === 'string') {
    const dosya = g.file_path.split(/[\\/]/).pop() ?? g.file_path
    const fiil: Record<string, string> = { Read: 'Okuyor', Write: 'Yazıyor', Edit: 'Düzenliyor' }

    return kisalt(`${fiil[arac] ?? kisaAd}: ${dosya}`)
  }
  if (arac === 'Grep' || arac === 'Glob') return 'Dosyalarda arıyor'

  return kisalt(kisaAd)
}

/**
 * Başlatılan alt ajanın kadrodaki masası: önce açıklamanın başındaki `[id]`
 * etiketi, yoksa türü (`tip`) eşleşen ilk ajan.
 */
function kadroIdBul(kadro: Kadro | null, tur: string, aciklama: string): string | undefined {
  if (!kadro) return undefined
  const hepsi = kadro.departmanlar.flatMap(d => d.ajanlar)
  const etiket = /^\s*\[([^\]]+)\]/.exec(aciklama)?.[1]?.trim()
  if (etiket) {
    const bulunan = hepsi.find(a => a.id === etiket || a.ad.toLocaleLowerCase('tr-TR') === etiket.toLocaleLowerCase('tr-TR'))
    if (bulunan) return bulunan.id
  }

  return hepsi.find(a => a.tip === tur)?.id
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const oku = async (dosya: string): Promise<string | undefined> => {
      try {
        const kok = await $.session.cwd()
        const metin = await $.fs.read(`${kok}/ofis/${dosya}`)

        return String(metin).replace(/^﻿/, '')
      } catch {
        return undefined
      }
    }
    const yenile = async () => {
      const k = await oku('kadro.json')
      if (k !== undefined && k !== sonKadro) {
        try {
          const veri = JSON.parse(k) as Kadro
          sonKadro = k
          mudurId = veri.mudur?.id ?? 'mudur'
          await update($, kadroAtom, () => veri)
        } catch {
          // yarım yazılmış dosya: bir sonraki turda yeniden okunur
        }
      }
      const d = await oku('durum.json')
      if (d !== undefined && d !== sonDurum) {
        try {
          const veri = JSON.parse(d) as Durum
          sonDurum = d
          const haller: Record<string, string> = {}
          for (const [id, kayit] of Object.entries(veri.ajanlar ?? {})) haller[id] = kayit.durum ?? 'bosta'
          const simdi = Date.now()
          const yeni: Yuruyus = {}
          if (oncekiHaller) {
            for (const [id, hal] of Object.entries(haller)) {
              if (hal !== 'bosta' && oncekiHaller[id] !== hal) yeni[id] = { t: simdi }
            }
          }
          oncekiHaller = haller
          // Aktarımlar: görülmemiş her "aktarim" satırı, ajanı hedefin masasına yürütür.
          let enBuyukNo = 0
          for (const satir of veri.kayit ?? []) {
            if (satir.durum !== 'aktarim' || typeof satir.no !== 'number') continue
            enBuyukNo = Math.max(enBuyukNo, satir.no)
            if (sonAktarimNo !== undefined && satir.no > sonAktarimNo && satir.ajan && satir.kime) {
              yeni[satir.ajan] = { t: simdi, hedef: satir.kime }
            }
          }
          sonAktarimNo = sonAktarimNo === undefined ? enBuyukNo : Math.max(sonAktarimNo, enBuyukNo)
          if (Object.keys(yeni).length > 0) {
            await update($, yuruyusAtom, eski => {
              const tutulan: Yuruyus = {}
              for (const [id, y] of Object.entries(eski ?? {})) if (simdi - y.t < 30000) tutulan[id] = y

              return { ...tutulan, ...yeni }
            })
          }
          await update($, durumAtom, () => ({ ajanlar: veri.ajanlar ?? {}, kayit: veri.kayit ?? [] }))
        } catch {
          // yarım yazılmış dosya: bir sonraki turda yeniden okunur
        }
      }
    }

    await $.command.register({ name: 'ofis', description: 'Ajan ofisi panelini açar' })
    await yenile()
    // Eskimiş canlı durumları temizler: müdür 45 sn araç çağırmadıysa boşa çıkar,
    // "teslim etti" 90 sn sonra silinir, takılı kalmış "çalışıyor" 20 dk sonra.
    const buda = async () => {
      const c = (await read($, canliAtom)) ?? {}
      const simdi = Date.now()
      const eskimis = Object.entries(c).filter(([id, v]) => {
        const yas = simdi - v.t
        if (id === mudurId) return yas > 45000

        return v.durum === 'bitti' ? yas > 90000 : yas > 1200000
      })
      if (eskimis.length === 0) return
      await update($, canliAtom, eski => {
        const kalan: Canli = { ...(eski ?? {}) }
        for (const [id] of eskimis) delete kalan[id]

        return kalan
      })
    }
    $.clock.every(1000, () => {
      tik++
      void yenile()
      if (tik % 5 === 0) void buda().catch(() => undefined)
    })
    void $.ui.open({ id: PANE, title: BASLIK })

    return next(e)
  })

  // Bir alt ajan başlatıldığında: kadrodaki masasını bul, çalışıyor yap, müdüre yürüt.
  on('agent.spawn', async ($, e, next) => {
    const sonuc = await next(e)
    try {
      if (!e.fork && sonuc.deny === undefined) {
        const id = kadroIdBul(await read($, kadroAtom), e.subagentType, e.description)
        if (id) {
          const simdi = Date.now()
          const gorev = kisalt(e.description.replace(/^\s*\[[^\]]+\]\s*/, ''))
          const agentId = sonuc.agentId
          await update($, canliAtom, c => ({ ...(c ?? {}), [id]: { durum: 'calisiyor' as const, gorev, t: simdi, agentId } }))
          await update($, yuruyusAtom, y => ({ ...(y ?? {}), [id]: { t: simdi } }))
          await update($, otoKayitAtom, l => [...(l ?? []), { zaman: zamanYazi(simdi), ajan: id, durum: 'calisiyor', gorev }].slice(-30))
        }
      }
    } catch {
      // izleme başarısız olsa da ajan çalışır
    }

    return sonuc
  })

  // Her araç çağrısı: ana döngüdeyse müdürün, alt ajandaysa o ajanın canlı etkinliği.
  on('tool.call', ($, e, next) => {
    const simdi = Date.now()
    if (e.agentId === undefined) {
      if (simdi - sonMudurYazim > 1200) {
        sonMudurYazim = simdi
        const gorev = aracOzeti(e)
        void update($, canliAtom, c => ({ ...(c ?? {}), [mudurId]: { durum: 'calisiyor' as const, gorev, t: simdi } })).catch(() => undefined)
      }
    } else {
      const agentId = e.agentId
      if (simdi - (sonAjanYazim[agentId] ?? 0) > 3000) {
        sonAjanYazim[agentId] = simdi
        const arac = aracOzeti(e)
        void update($, canliAtom, c => {
          const eski = c ?? {}
          const kayit = Object.entries(eski).find(([, v]) => v.agentId === agentId)
          if (!kayit) return eski

          return { ...eski, [kayit[0]]: { ...kayit[1], durum: 'calisiyor' as const, arac, t: simdi } }
        }).catch(() => undefined)
      }
    }

    return next(e)
  })

  // Tur sonu: ana döngüde müdür boşa çıkar; alt ajanda o ajan teslim eder ve müdüre yürür.
  on('turn.complete', async ($, e, next) => {
    const sonuc = await next(e)
    try {
      const simdi = Date.now()
      const agentId = e.agentId
      if (agentId === undefined) {
        await update($, canliAtom, c => {
          const kalan: Canli = { ...(c ?? {}) }
          delete kalan[mudurId]

          return kalan
        })
      } else {
        const c = (await read($, canliAtom)) ?? {}
        const kayit = Object.entries(c).find(([, v]) => v.agentId === agentId)
        if (kayit) {
          const [id, v] = kayit
          await update($, canliAtom, eski => ({ ...(eski ?? {}), [id]: { durum: 'bitti' as const, gorev: v.gorev, t: simdi, agentId } }))
          await update($, yuruyusAtom, y => ({ ...(y ?? {}), [id]: { t: simdi } }))
          await update($, otoKayitAtom, l => [...(l ?? []), { zaman: zamanYazi(simdi), ajan: id, durum: 'bitti', gorev: v.gorev }].slice(-30))
        }
      }
    } catch {
      // izleme başarısız olsa da tur biter
    }

    return sonuc
  })

  on('command.run', { command: 'ofis' }, async $ => {
    const sonuc = await $.ui.open({ id: PANE, title: BASLIK })
    if (sonuc.isPlaced) return { text: 'Ajan ofisi paneli açıldı.' }

    return { text: `Ajan ofisi paneli açık ama çizilemiyor: ${sonuc.reason}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const kadro = await read($, kadroAtom)
    const durum = await read($, durumAtom)
    const yuruyus = await read($, yuruyusAtom)
    const canli = (await read($, canliAtom)) ?? {}
    const otoKayit = (await read($, otoKayitAtom)) ?? []

    if (!kadro) {
      return (
        <Box flexDirection="column">
          <Text bold>{BASLIK}</Text>
          <Text dimColor>Bu oturumun klasöründe ofis/kadro.json bulunamadı.</Text>
        </Box>
      )
    }

    const { liste } = kisiler(kadro, durum, canli)
    const mudur = liste[0]
    const calisan = liste.filter(a => a.hal === 'calisiyor')
    const biten = liste.filter(a => a.hal === 'bitti')
    const bosta = liste.length - calisan.length - biten.length
    const adOf = (id?: string) => liste.find(a => a.id === id)?.ad ?? id ?? '?'
    // Pano: dosyadaki satırlar ile kendiliğinden izlenenler, en yenisi üstte.
    const pano = [...(durum.kayit ?? []), ...otoKayit]
      .map((k, i) => ({ k, i }))
      .sort((p, q) => (q.k.zaman ?? '').localeCompare(p.k.zaman ?? '') || q.i - p.i)
      .slice(0, 8)
      .map(p => p.k)

    let harita = null
    if (e.surface !== 'terminal') {
      const { Svg } = $.ui.resolve(e)
      const { kaynak, yukseklik } = ofisSvg(kadro, durum, canli, yuruyus ?? {}, Date.now())
      // Panel genişliği karakter hücresiyle gelir; haritayı ona göre piksele çevir.
      const genislik = Math.max(240, Math.min(900, Math.round((e.props.bodyColumns ?? 55) * 7.4)))
      // isInteractive: SVG'yi animasyonları oynatan çerçevede çizer; düz resim kipi oynatmaz.
      // Çerçeve kendi boyutunu içerikten almadığı için genişlik ve yükseklik açıkça verilir.
      harita = (
        <Svg
          source={kaynak}
          alt={`Ofis haritası: ${calisan.length} ajan çalışıyor, ${biten.length} teslim etti, ${bosta} boşta.`}
          width={genislik}
          height={Math.round((genislik * yukseklik) / W)}
          isInteractive
        />
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>
            {mudur?.ad ?? 'Müdür'} · Komuta Merkezi — {ETIKET[mudur?.hal ?? 'bosta']}
          </Text>
          <Text dimColor>{mudur?.gorev || 'Görev bekleniyor'}</Text>
          <Text>
            <Text color="#2e9e5b">■</Text> çalışan {calisan.length} <Text color="#2f6fd0">■</Text> teslim {biten.length}{' '}
            <Text dimColor>■ boşta {bosta}</Text>
          </Text>
        </Box>
        {harita}
        <Box flexDirection="column">
          <Text bold>Görevler</Text>
          {calisan.length + biten.length === 0 && <Text dimColor>Açık görev yok.</Text>}
          {[...calisan, ...biten].map(a => (
            <Text>
              <Text color={a.hal === 'calisiyor' ? '#2e9e5b' : '#2f6fd0'}>■</Text> {a.ad} ({a.unvan}) — {ETIKET[a.hal]}
              {a.gorev ? ': ' + a.gorev : ''}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column">
          <Text bold>Pano</Text>
          {pano.length === 0 && <Text dimColor>Henüz hareket yok.</Text>}
          {pano.map(k => (
            <Text dimColor={k.durum === 'bosta'}>
              {(k.zaman ?? '').slice(11, 16)} {adOf(k.ajan)}{' '}
              {k.durum === 'aktarim'
                ? '→ ' + adOf(k.kime)
                : k.durum === 'calisiyor'
                  ? 'başladı'
                  : k.durum === 'bitti'
                    ? 'teslim etti'
                    : 'boşa çıktı'}
              {k.gorev ? ': ' + k.gorev : ''}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
