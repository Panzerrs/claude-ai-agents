export type KadroAjan = { id: string; ad: string; unvan: string; emoji?: string; tip?: string }
export type Kadro = {
  mudur: KadroAjan
  departmanlar: { ad: string; ajanlar: KadroAjan[] }[]
}
export type AjanDurum = { durum?: string; gorev?: string; zaman?: string }
/** Pano satırı. `durum: "aktarim"` ise `ajan` sonucu `kime` ajanına aktarmıştır; `no` aktarımın sıra numarasıdır. */
export type Kayit = { zaman?: string; ajan?: string; durum?: string; gorev?: string; kime?: string; no?: number }
export type Durum = { ajanlar: Record<string, AjanDurum>; kayit: Kayit[] }
/** Ajan id'si -> süren yürüyüş: başladığı an (epoch ms) ve gittiği ajan (yoksa müdür). */
export type Yuruyus = Record<string, { t: number; hedef?: string }>
/**
 * Ajan id'si -> motorun olaylarından kendiliğinden izlenen canlı durum:
 * ne yapıyor, en son hangi aracı kullandı, ne zaman, hangi alt ajan döngüsünde.
 */
export type Canli = Record<string, { durum: 'calisiyor' | 'bitti'; gorev: string; arac?: string; t: number; agentId?: string }>

declare module 'claude-code' {
  interface PluginState {
    'ajan-ofisi': {
      kadro: Shaped<Kadro | null>
      durum: Shaped<Durum>
      yuruyus: Shaped<Yuruyus>
      canli: Shaped<Canli>
      otoKayit: Shaped<Kayit[]>
    }
  }
}
