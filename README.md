[English](#english) | [Türkçe](#türkçe)

# English

## What it is

`claude-ai-agents` is an "agent office" for the Claude Code desktop app. A manager (the main Claude session) splits your work among specialist subagents on a roster, checks their results, and gives you a single report. A panel next to the chat shows the office as a pixel map.

- Splits a job into parts and assigns them to the roster in `ofis/kadro.json`.
- Shows an "Ajan Ofisi" panel with a pixel office map, the manager's status, open tasks, and a log.
- Follows real work automatically from the app's events; it makes no model calls and spends no tokens.
- Applies token-saving rules: do small jobs yourself, use the cheapest agent type that fits, cap the number of agents.

The project is experimental.

## How it works

There are three parts:

1. `ajan-ofisi`, the plugin. It draws the panel and registers the `/ofis` command.
2. The `mudur` skill (`skills/mudur/SKILL.md`). It holds the manager's working rules.
3. The `ofis/` folder. It holds the roster (`kadro.json`) and the status script (`durum.ps1`), and you copy it into your project folder.

Flow: you give the manager a job. The manager reads `ofis/kadro.json`, starts subagents, checks what comes back, and reports.

The panel watches these app events by itself: a subagent starting, a tool call, and the end of a turn. When an agent receives a task it walks to the manager's room; when it delivers, it walks there again. When the manager passes one agent's result to another, the giving agent walks to the receiver's desk. Only handoffs are written by hand (`durum.ps1 -Kime`), because only the manager knows about them.

Agents do not talk to each other directly. The manager is the only bridge: it distills one agent's output and writes it into the next agent's brief.

## Installation

In a terminal session prompt:

```
/plugin install ajan-ofisi --marketplace Panzerrs/claude-ai-agents
```

From a shell:

```
claude plugin install ajan-ofisi --marketplace Panzerrs/claude-ai-agents
```

In the desktop app, when `/plugin` does not work: click the + button next to the prompt box, then Plugins, then "Add marketplace" with `Panzerrs/claude-ai-agents`, then "Add plugin".

After installing, copy the repository's `ofis/` folder to the root of your own project folder. The panel looks for `ofis/kadro.json` and `ofis/durum.json` in the session's working folder. If the panel is closed, open it with `/ofis`.

## Usage

**Give the manager a job.** The `mudur` skill triggers on phrases such as `/mudur`, "müdüre ver", "ekibe yaptır", and "ofise iş ver" (the full list is in `SKILL.md`). Calling the skill is explicit permission for the manager to start subagents.

**`/ofis`** opens the "Ajan Ofisi" panel.

**In the panel** you see:

- the manager's status and current task, and counts of working, delivered, and idle agents;
- the pixel office map (desktop app only), with the manager's room and one desk per agent, grouped by department;
- a "Görevler" list of working and delivered agents;
- a "Pano" log of the latest 8 events, including handoffs shown as "A → B".

In the terminal, the map is not drawn; you get the text lists only.

## Roster

Copied from `ofis/kadro.json`. The manager is `mudur` (Müdür, Ofis Müdürü).

| Department | Name | Role | Agent type (`tip`) | Suggested skills (`skiller`) |
|---|---|---|---|---|
| Yazılım | Deniz | Backend Geliştirici | `voltagent-core-dev:backend-developer` | `claude-api`, `run`, `simplify` |
| Yazılım | Elif | Frontend Geliştirici | `voltagent-core-dev:frontend-developer` | `artifact-design`, `dataviz`, `run` |
| Yazılım | Baran | DevOps Mühendisi | `voltagent-infra:devops-engineer` | `run`, `update-config` |
| Yazılım | Selin | Test Uzmanı | `voltagent-qa-sec:qa-expert` | `code-review`, `run` |
| Yazılım | Tolga | Güvenlik Denetçisi | `voltagent-qa-sec:security-auditor` | `security-review`, `code-review` |
| Araştırma | Zeynep | Pazar Araştırmacısı | `voltagent-research:market-researcher` | `research-ops-skills:market-research`, `anthropic-skills:deep-research` |
| Araştırma | Emre | Rakip Analisti | `voltagent-research:competitive-analyst` | `dossier:dossier`, `patent:patent` |
| Araştırma | Ada | Trend Analisti | `voltagent-research:trend-analyst` | `pulse:pulse` |
| Araştırma | Mert | Araştırma Analisti | `voltagent-research:research-analyst` | `research-orchestrator:research`, `litreview:litreview`, `meta-research:meta-research`, `deepread:deepread` |
| İş ve Pazarlama | Ceren | Ürün Yöneticisi | `voltagent-biz:product-manager` | `research-ops-skills:product-research`, `research-ops-skills:interview-mapper`, `roast:roast` |
| İş ve Pazarlama | Kaan | İçerik Pazarlamacısı | `voltagent-biz:content-marketer` | `anthropic-skills:docx`, `anthropic-skills:pptx`, `anthropic-skills:pdf` |
| İş ve Pazarlama | Derya | SEO Uzmanı | `voltagent-domains:seo-specialist` | `pulse:pulse` |
| İş ve Pazarlama | Onur | Satış Mühendisi | `voltagent-biz:sales-engineer` | `dossier:dossier`, `anthropic-skills:pptx` |
| Finans | Aslı | Veri Analisti | `voltagent-data-ai:data-analyst` | `anthropic-skills:xlsx`, `dataviz`, `finance-skills:financial-analyst` |
| Finans | Cem | Risk Yöneticisi | `voltagent-domains:risk-manager` | `business-investment-advisor:business-investment-advisor`, `finance-skills:passive-deal-screener` |
| Finans | İpek | Kantitatif Analist | `voltagent-domains:quant-analyst` | `finance-skills:stock-analysis`, `finance-skills:financial-analyst` |
| Finans | Murat | Kapanış Kontrolörü | `month-end-close:cs-close-controller` | `month-end-close:month-end-close`, `finance-skills:saas-metrics-coach` |

The `tip` and `skiller` values come from the author's own plugin setup (for example `voltagent-*`, `finance-skills`, `anthropic-skills`). If your setup does not have them, edit `ofis/kadro.json` to match the agent types and skills you have installed.

## Skills

This repository ships one skill, `mudur`. The other skills named in the roster are not included; they come from plugins the author has installed, and the manager only points agents at them.

| Skill | Ships here | What it does |
|---|---|---|
| `mudur` | Yes | The office manager's rules: decide whether a job needs the team, pick agents and models, write bounded briefs, check results, pass outputs along a chain, report once. |
| `claude-api` | No | Reference for building on the Claude API: model ids, parameters, tool use, caching. |
| `run` | No | Launches and drives the project's app to confirm a change works. |
| `simplify` | No | Reviews changed code for reuse and simplification, then applies the fixes. |
| `code-review` | No | Reviews a diff or pull request for correctness bugs. |
| `security-review` | No | Security review of the pending changes on a branch. |
| `update-config` | No | Edits Claude Code settings, permissions and hooks. |
| `artifact-design` | No | Design guidance for published pages. |
| `dataviz` | No | Rules for charts and dashboards: form, color, accessibility. |
| `anthropic-skills:xlsx` | No | Creates, reads and edits spreadsheets. |
| `anthropic-skills:docx` | No | Creates, reads and edits Word documents. |
| `anthropic-skills:pptx` | No | Creates, reads and edits slide decks. |
| `anthropic-skills:pdf` | No | Reads, merges, splits, fills and creates PDF files. |
| `anthropic-skills:deep-research` | No | Multi-source research synthesized into a report. |
| `research-orchestrator:research` | No | Routes a research request to the right research skill. |
| `research-ops-skills:market-research` | No | Market sizing, survey sample sizes, segment scoring. |
| `research-ops-skills:product-research` | No | Plans and synthesizes user research. |
| `research-ops-skills:interview-mapper` | No | Codes one interview transcript into quote-backed findings. |
| `litreview:litreview` | No | Plans and runs a literature search and writes an orientation guide. |
| `meta-research:meta-research` | No | High-stakes research where each claim is checked against three or more sources. |
| `deepread:deepread` | No | Deep reading of a book or document: claims, evidence, knowledge map. |
| `pulse:pulse` | No | What people are saying about a topic right now across Reddit, Hacker News and the web. |
| `dossier:dossier` | No | Diligence or meeting prep on a company, person or organization. |
| `patent:patent` | No | Prior-art search, freedom-to-operate and patent landscape. |
| `roast:roast` | No | A five-angle panel attacks a business idea and returns one verdict. |
| `finance-skills:financial-analyst` | No | Financial statement analysis, DCF valuation, budget variance, forecasts. |
| `finance-skills:stock-analysis` | No | Research and valuation of a listed company. |
| `finance-skills:saas-metrics-coach` | No | ARR, MRR, churn, LTV, CAC and related SaaS metrics. |
| `finance-skills:passive-deal-screener` | No | Screens a private deal from a passive investor's side. |
| `business-investment-advisor:business-investment-advisor` | No | ROI, IRR, NPV and payback for a capital expense. |
| `month-end-close:month-end-close` | No | Month-end close checklist, reconciliations and flux explanations. |

## The manager's rules (summary)

See `skills/mudur/SKILL.md` for the full text.

- **Token saving.** Before assigning anyone, ask whether the job needs the team. A question, a one-file fix, or a few tool calls: the manager does it. If one skill solves it, the manager calls the skill itself. Agents are for work that splits up or is long and independent.
- **Limits.** At most three agents per job by default (more needs your approval). Do not give the same work to two agents. If a result is incomplete, message the same agent instead of starting a new one.
- **Agent type and model.** A job without a skill uses the agent's own `tip` (cheap). A job that needs a skill uses `general-purpose`, because specialist types have no Skill tool. Use `haiku` for lookups and conversions, `sonnet` as the default, and the main model only for hard reasoning. In one session, starting a specialist type cost about 9 thousand tokens and a general agent about 53 thousand; these are approximate values measured in a single session, not general facts.
- **Briefs.** Complete and bounded: scope, budget (default 6 searches), output format and length (default 300 words), and a stopping criterion.
- **Skills.** The manager checks the installed skills first and names the skill in the brief of a `general-purpose` agent. The `skiller` list is a suggestion, not a limit.
- **Sequential work and handoff.** Independent parts run in parallel. When one part needs another's result, the manager checks the first output, distills it to at most 150 words, records the handoff with `durum.ps1 -Kime`, and passes it in the next brief. A chain has at most three links.
- **Other rules.** Delete, send, publish, and purchase actions are decided by you, not by an agent. Failures are reported as failures. The final report gives the result first, then who did what, then open points.

## Using `durum.ps1`

`ofis/durum.ps1` updates `ofis/durum.json`. Usage lines from the top of the script:

```powershell
durum.ps1 -Ajan backend -Durum calisiyor -Gorev "API taslagi"
durum.ps1 -Ajan backend -Durum bitti -Gorev "API taslagi hazir"
durum.ps1 -Ajan backend -Durum bosta
durum.ps1 -Ajan pazar -Kime urun -Gorev "pazar ozeti"     # handoff: pazar -> urun
durum.ps1 -Sifirla
```

`-Durum` accepts `bosta`, `calisiyor`, or `bitti`. `-Ajan` is an `id` from `kadro.json`. `-Sifirla` clears the board. The manager normally runs only the `-Kime` form and `-Sifirla`; everything else the panel tracks by itself.

## Customization

Edit `ofis/kadro.json`. Each agent has `id`, `ad`, `unvan`, optional `emoji`, `tip` (the `subagent_type`), and `skiller`. Departments are listed under `departmanlar`. The manager re-reads the file before starting work, and the panel reloads it while running.

The `[id]` tag: the `description` field of every Agent call must start with the agent's roster id in square brackets, for example `[icerik] README taslağı`. The panel recognizes the agent from this tag. Without a tag, the panel falls back to the first roster agent whose `tip` matches the agent type. A `general-purpose` agent without a tag is written to no desk.

## Requirements and limits

- Claude Code desktop app. The panel was tested there. In a terminal, only a text list is drawn instead of the map.
- `durum.ps1` is a PowerShell script, tested on Windows.
- The `tip` and `skiller` values assume the plugins listed above; adapt `kadro.json` if you lack them.
- The project is experimental.

## License

MIT.

---

# Türkçe

## Ne olduğu

`claude-ai-agents`, Claude Code masaüstü uygulaması için bir "ajan ofisi"dir. Müdür (ana Claude oturumu), işi kadrodaki uzman alt ajanlara dağıtır, sonuçları denetler ve size tek bir rapor verir. Sohbetin yanındaki bir panel ofisi piksel harita olarak gösterir.

- İşi parçalara böler ve `ofis/kadro.json` içindeki kadroya dağıtır.
- Piksel ofis haritası, müdürün durumu, açık görevler ve bir pano içeren "Ajan Ofisi" panelini gösterir.
- Gerçek çalışmayı uygulamanın olaylarından kendiliğinden izler; model çağrısı yapmaz, token harcamaz.
- Token tasarrufu kurallarını uygular: küçük işi kendin yap, uyan en ucuz ajan türünü seç, ajan sayısını sınırla.

Proje deneyseldir.

## Nasıl çalışır

Üç parça vardır:

1. `ajan-ofisi` eklentisi. Paneli çizer ve `/ofis` komutunu kaydeder.
2. `mudur` skill'i (`skills/mudur/SKILL.md`). Müdürün çalışma kurallarını içerir.
3. `ofis/` klasörü. Kadroyu (`kadro.json`) ve durum betiğini (`durum.ps1`) içerir; proje klasörünüze kopyalanır.

Akış: müdüre bir iş verirsiniz. Müdür `ofis/kadro.json` dosyasını okur, alt ajanları başlatır, gelen sonucu denetler ve rapor verir.

Panel şu uygulama olaylarını kendiliğinden izler: alt ajan başlatma, araç çağrısı ve tur sonu. Bir ajan görev alınca müdürün odasına yürür; teslim edince yine oraya yürür. Müdür bir ajanın sonucunu diğerine aktarınca veren ajan alanın masasına yürür. Elle yazılan tek şey aktarımdır (`durum.ps1 -Kime`), çünkü onu yalnızca müdür bilir.

Ajanlar birbirleriyle doğrudan konuşmaz. Aralarındaki tek köprü müdürdür: bir ajanın çıktısını damıtır ve sonraki ajanın brifine yazar.

## Kurulum

Terminal oturumunun isteminde:

```
/plugin install ajan-ofisi --marketplace Panzerrs/claude-ai-agents
```

Kabuktan:

```
claude plugin install ajan-ofisi --marketplace Panzerrs/claude-ai-agents
```

Masaüstü uygulamasında (`/plugin` çalışmadığında): istem kutusunun yanındaki + düğmesi, sonra Plugins, "Add marketplace" ile `Panzerrs/claude-ai-agents`, sonra "Add plugin".

Kurulumdan sonra depodaki `ofis/` klasörünü kendi proje klasörünüzün köküne kopyalayın. Panel `ofis/kadro.json` ve `ofis/durum.json` dosyalarını oturumun çalışma klasöründe arar. Panel kapalıysa `/ofis` ile açılır.

## Kullanım

**Müdüre iş verme.** `mudur` skill'i `/mudur`, "müdüre ver", "ekibe yaptır" ve "ofise iş ver" gibi ifadelerle tetiklenir (tam liste `SKILL.md` içindedir). Skill'i çağırmanız, müdürün alt ajan başlatması için açık izindir.

**`/ofis`** "Ajan Ofisi" panelini açar.

**Panelde** şunları görürsünüz:

- müdürün durumu ve görevi, çalışan, teslim eden ve boştaki ajan sayıları;
- piksel ofis haritası (yalnızca masaüstü uygulamasında): müdür odası ve departmanlara göre gruplanmış, her ajan için bir masa;
- çalışan ve teslim eden ajanların "Görevler" listesi;
- son 8 olayın "Pano" kaydı; aktarımlar "A → B" olarak görünür.

Terminalde harita çizilmez; yalnızca metin listeleri çıkar.

## Kadro

`ofis/kadro.json` dosyasından alınmıştır. Müdür `mudur` kimliğiyle tanımlıdır (Müdür, Ofis Müdürü).

| Departman | Ad | Rol | Ajan türü (`tip`) | Önerilen skill'ler (`skiller`) |
|---|---|---|---|---|
| Yazılım | Deniz | Backend Geliştirici | `voltagent-core-dev:backend-developer` | `claude-api`, `run`, `simplify` |
| Yazılım | Elif | Frontend Geliştirici | `voltagent-core-dev:frontend-developer` | `artifact-design`, `dataviz`, `run` |
| Yazılım | Baran | DevOps Mühendisi | `voltagent-infra:devops-engineer` | `run`, `update-config` |
| Yazılım | Selin | Test Uzmanı | `voltagent-qa-sec:qa-expert` | `code-review`, `run` |
| Yazılım | Tolga | Güvenlik Denetçisi | `voltagent-qa-sec:security-auditor` | `security-review`, `code-review` |
| Araştırma | Zeynep | Pazar Araştırmacısı | `voltagent-research:market-researcher` | `research-ops-skills:market-research`, `anthropic-skills:deep-research` |
| Araştırma | Emre | Rakip Analisti | `voltagent-research:competitive-analyst` | `dossier:dossier`, `patent:patent` |
| Araştırma | Ada | Trend Analisti | `voltagent-research:trend-analyst` | `pulse:pulse` |
| Araştırma | Mert | Araştırma Analisti | `voltagent-research:research-analyst` | `research-orchestrator:research`, `litreview:litreview`, `meta-research:meta-research`, `deepread:deepread` |
| İş ve Pazarlama | Ceren | Ürün Yöneticisi | `voltagent-biz:product-manager` | `research-ops-skills:product-research`, `research-ops-skills:interview-mapper`, `roast:roast` |
| İş ve Pazarlama | Kaan | İçerik Pazarlamacısı | `voltagent-biz:content-marketer` | `anthropic-skills:docx`, `anthropic-skills:pptx`, `anthropic-skills:pdf` |
| İş ve Pazarlama | Derya | SEO Uzmanı | `voltagent-domains:seo-specialist` | `pulse:pulse` |
| İş ve Pazarlama | Onur | Satış Mühendisi | `voltagent-biz:sales-engineer` | `dossier:dossier`, `anthropic-skills:pptx` |
| Finans | Aslı | Veri Analisti | `voltagent-data-ai:data-analyst` | `anthropic-skills:xlsx`, `dataviz`, `finance-skills:financial-analyst` |
| Finans | Cem | Risk Yöneticisi | `voltagent-domains:risk-manager` | `business-investment-advisor:business-investment-advisor`, `finance-skills:passive-deal-screener` |
| Finans | İpek | Kantitatif Analist | `voltagent-domains:quant-analyst` | `finance-skills:stock-analysis`, `finance-skills:financial-analyst` |
| Finans | Murat | Kapanış Kontrolörü | `month-end-close:cs-close-controller` | `month-end-close:month-end-close`, `finance-skills:saas-metrics-coach` |

`tip` ve `skiller` değerleri yazarın kendi kurulumundaki eklentilerden gelir (örneğin `voltagent-*`, `finance-skills`, `anthropic-skills`). Sizin kurulumunuzda bunlar yoksa `ofis/kadro.json` dosyasını kendi yüklü ajan türlerinize ve skill'lerinize göre düzenleyin.

## Skill'ler

Bu depo tek bir skill içerir: `mudur`. Kadroda adı geçen diğer skill'ler depoda yoktur; yazarın kurduğu eklentilerden gelir ve müdür yalnızca ajanları onlara yönlendirir.

| Skill | Depoda var mı | Ne yapar |
|---|---|---|
| `mudur` | Evet | Ofis müdürünün kuralları: işin ekibe gerek duyup duymadığına karar verir, ajan ve model seçer, sınırlı brif yazar, sonucu denetler, çıktıyı zincirde aktarır, tek rapor verir. |
| `claude-api` | Hayır | Claude API ile geliştirme başvurusu: model kimlikleri, parametreler, araç kullanımı, önbellek. |
| `run` | Hayır | Projenin uygulamasını başlatıp bir değişikliğin çalıştığını doğrular. |
| `simplify` | Hayır | Değişen kodu yeniden kullanım ve sadeleştirme açısından inceler, düzeltmeleri uygular. |
| `code-review` | Hayır | Bir farkı ya da çekme isteğini doğruluk hataları için inceler. |
| `security-review` | Hayır | Daldaki bekleyen değişikliklerin güvenlik incelemesi. |
| `update-config` | Hayır | Claude Code ayarlarını, izinlerini ve hook'larını düzenler. |
| `artifact-design` | Hayır | Yayınlanan sayfalar için tasarım yönergeleri. |
| `dataviz` | Hayır | Grafik ve pano kuralları: biçim, renk, erişilebilirlik. |
| `anthropic-skills:xlsx` | Hayır | Elektronik tablo oluşturur, okur ve düzenler. |
| `anthropic-skills:docx` | Hayır | Word belgesi oluşturur, okur ve düzenler. |
| `anthropic-skills:pptx` | Hayır | Sunum oluşturur, okur ve düzenler. |
| `anthropic-skills:pdf` | Hayır | PDF okur, birleştirir, böler, doldurur ve oluşturur. |
| `anthropic-skills:deep-research` | Hayır | Çok kaynaklı araştırmayı bir rapora dönüştürür. |
| `research-orchestrator:research` | Hayır | Araştırma isteğini doğru araştırma skill'ine yönlendirir. |
| `research-ops-skills:market-research` | Hayır | Pazar büyüklüğü, anket örneklem sayısı, segment puanlama. |
| `research-ops-skills:product-research` | Hayır | Kullanıcı araştırmasını planlar ve sentezler. |
| `research-ops-skills:interview-mapper` | Hayır | Tek bir görüşme dökümünü alıntıya dayalı bulgulara çevirir. |
| `litreview:litreview` | Hayır | Literatür taramasını planlar, yürütür ve bir yönlendirme rehberi yazar. |
| `meta-research:meta-research` | Hayır | Her iddianın üç ya da daha fazla kaynakla sınandığı, hatası pahalı araştırma. |
| `deepread:deepread` | Hayır | Bir kitabın ya da belgenin derin okuması: iddialar, kanıtlar, bilgi haritası. |
| `pulse:pulse` | Hayır | Bir konu hakkında şu an Reddit, Hacker News ve web'de ne konuşulduğu. |
| `dossier:dossier` | Hayır | Bir şirket, kişi ya da kurum için inceleme ve toplantı hazırlığı. |
| `patent:patent` | Hayır | Önceki teknik taraması, kullanım serbestliği ve patent görünümü. |
| `roast:roast` | Hayır | Beş açılı bir kurul bir iş fikrini eleştirir ve tek karar verir. |
| `finance-skills:financial-analyst` | Hayır | Mali tablo analizi, DCF değerleme, bütçe sapması, tahmin. |
| `finance-skills:stock-analysis` | Hayır | Borsada işlem gören bir şirketin araştırması ve değerlemesi. |
| `finance-skills:saas-metrics-coach` | Hayır | ARR, MRR, kayıp oranı, LTV, CAC ve ilgili SaaS metrikleri. |
| `finance-skills:passive-deal-screener` | Hayır | Özel bir yatırım fırsatını pasif yatırımcı gözüyle eler. |
| `business-investment-advisor:business-investment-advisor` | Hayır | Bir sermaye harcaması için ROI, IRR, NPV ve geri ödeme süresi. |
| `month-end-close:month-end-close` | Hayır | Ay sonu kapanış listesi, mutabakatlar ve sapma açıklamaları. |

## Müdürün kuralları (özet)

Tam metin için `skills/mudur/SKILL.md` dosyasına bakın.

- **Token tasarrufu.** Müdür kimseyi görevlendirmeden önce işin ekibe gerek duyup duymadığını sorar. Bir soru, tek dosyalık düzeltme ya da birkaç araç çağrısı: müdür kendi yapar. Tek bir skill işi çözüyorsa skill'i kendisi çağırır. Ajan, ancak bölünebilen ya da uzun ve bağımsız işler içindir.
- **Sınırlar.** Varsayılan olarak bir iş için en fazla üç ajan (fazlası için onayınız gerekir). Aynı işi iki ajana verme. Sonuç eksikse yeni ajan başlatma, aynı ajana mesaj yaz.
- **Ajan türü ve model.** Skill gerektirmeyen iş ajanın kendi `tip` değerini kullanır (ucuz). Skill gerektiren iş `general-purpose` kullanır, çünkü uzman türlerde Skill aracı yoktur. Bulup getirme ve dönüştürme için `haiku`, varsayılan olarak `sonnet`, yalnızca zor akıl yürütmede ana model. Tek bir oturumda uzman tür başlatmak yaklaşık 9 bin, genel ajan yaklaşık 53 bin token tuttu; bunlar tek oturumda ölçülen yaklaşık değerlerdir, genel bir gerçek değildir.
- **Brifler.** Eksiksiz ve sınırlı: kapsam, bütçe (varsayılan 6 arama), çıktı biçimi ve uzunluğu (varsayılan 300 kelime) ve durma ölçütü.
- **Skill kullanımı.** Müdür önce yüklü skill'lere bakar ve `general-purpose` ajanın brifinde skill'i adıyla söyler. `skiller` listesi öneridir, sınır değildir.
- **Sıralı iş ve aktarım.** Bağımsız parçalar paralel çalışır. Bir parça diğerinin sonucuna bağlıysa müdür ilk çıktıyı denetler, en fazla 150 kelimeye damıtır, aktarımı `durum.ps1 -Kime` ile panoya yazar ve sonraki brife ekler. Bir zincir en fazla üç halkadır.
- **Diğer kurallar.** Silme, gönderme, yayınlama ve satın alma kararını ajan değil siz verirsiniz. Başarısızlık başarısızlık olarak raporlanır. Son rapor önce sonucu, sonra kimin ne yaptığını, sonra açık noktaları verir.

## `durum.ps1` kullanımı

`ofis/durum.ps1`, `ofis/durum.json` dosyasını günceller. Betiğin başındaki kullanım satırları:

```powershell
durum.ps1 -Ajan backend -Durum calisiyor -Gorev "API taslagi"
durum.ps1 -Ajan backend -Durum bitti -Gorev "API taslagi hazir"
durum.ps1 -Ajan backend -Durum bosta
durum.ps1 -Ajan pazar -Kime urun -Gorev "pazar ozeti"     # aktarım: pazar -> urun
durum.ps1 -Sifirla
```

`-Durum` değeri `bosta`, `calisiyor` veya `bitti` olabilir. `-Ajan`, `kadro.json` içindeki bir `id`'dir. `-Sifirla` panoyu temizler. Müdür normalde yalnızca `-Kime` biçimini ve `-Sifirla` komutunu çalıştırır; gerisini panel kendiliğinden izler.

## Özelleştirme

`ofis/kadro.json` dosyasını düzenleyin. Her ajanın `id`, `ad`, `unvan`, isteğe bağlı `emoji`, `tip` (`subagent_type`) ve `skiller` alanları vardır. Departmanlar `departmanlar` altında listelenir. Müdür işe başlamadan önce dosyayı yeniden okur, panel de çalışırken yeniden yükler.

`[id]` etiketi: her Agent çağrısının `description` alanı, ajanın kadro kimliğiyle köşeli parantez içinde başlamalıdır, örneğin `[icerik] README taslağı`. Panel ajanı bu etiketten tanır. Etiket yoksa panel, `tip` değeri ajan türüyle eşleşen ilk kadro ajanına yazar. Etiketsiz bir `general-purpose` ajan hiçbir masaya yazılmaz.

## Gereksinimler ve sınırlar

- Claude Code masaüstü uygulaması. Panel orada sınandı. Terminalde harita yerine yalnızca metin listesi çizilir.
- `durum.ps1` bir PowerShell betiğidir; Windows'ta sınandı.
- `tip` ve `skiller` değerleri yukarıda sayılan eklentilerin kurulu olduğunu varsayar; yoksa `kadro.json` dosyasını uyarlayın.
- Proje deneyseldir.

## Lisans

MIT.
