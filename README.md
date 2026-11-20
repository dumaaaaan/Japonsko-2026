# 🇯🇵 Japonsko 2026 – interaktivní cestovní deník

Statický web (HTML + CSS + JavaScript), na kterém rodina a přátelé uvidí:

- **kde právě jsme** (podle japonského data se automaticky zvýrazní dnešní den a město),
- **kalendář všech dní** a **denní program** (plánované ✕ absolvované aktivity),
- **časovou osu / itinerář** s jednodenními výlety pod výchozím městem,
- **interaktivní mapu** (Leaflet + OpenStreetMap) s městy, trasou, výlety a navštívenými místy,
- **deník** s fotkami a krátkými poznámkami.

Web nepotřebuje žádný server, databázi, placenou službu ani API klíč. Hostuje se zdarma na **GitHub Pages**.

---

## 📁 Struktura projektu

```
japonsko-2026/
├── index.html            ← stránka (struktura)
├── trip-data.json        ← ⭐ VEŠKERÝ OBSAH CESTY – tady se upravuje program
├── css/style.css         ← design
├── js/app.js             ← logika (kalendář, mapa, režim úprav)
├── photos/               ← sem nahrávejte fotky z cesty
├── vendor/leaflet/       ← knihovna pro mapu (přibalená, nic se nestahuje z CDN)
├── .nojekyll             ← pro GitHub Pages (nemazat)
└── README.md
```

> Design ani kód není potřeba měnit. Všechen obsah (města, dny, aktivity, výlety, poznámky, fotky) je v `trip-data.json`.

---

## 🚀 Zveřejnění přes GitHub Pages (jednorázově, cca 10 minut)

Vše jde udělat jen přes webový prohlížeč, bez instalace čehokoli.

1. Založte si účet na [github.com](https://github.com) (zdarma), pokud ho ještě nemáte.
2. Vpravo nahoře **+ → New repository**.
   - *Repository name*: např. `japonsko-2026`
   - Zvolte **Public** (GitHub Pages zdarma funguje pro veřejné repozitáře).
   - Klikněte **Create repository**.
3. V novém repozitáři klikněte na odkaz **uploading an existing file**.
4. Rozbalte ZIP s projektem a **přetáhněte do okna obsah složky `japonsko-2026`** (tj. `index.html`, `trip-data.json`, složky `css`, `js`, `photos`, `vendor` a soubor `.nojekyll`).
   - Tip: soubor `.nojekyll` je skrytý. Pokud ho nevidíte, nevadí – web funguje i bez něj.
5. Dole klikněte **Commit changes**.
6. Otevřete **Settings → Pages**.
   - *Source*: **Deploy from a branch**
   - *Branch*: **main** a složka **/ (root)** → **Save**.
7. Po 1–2 minutách se nahoře v *Settings → Pages* objeví adresa webu, např.:
   `https://vase-jmeno.github.io/japonsko-2026/`
8. Tuto adresu pošlete rodičům. Hotovo. 🎉

> ⚠️ **Soukromí:** stránka je veřejná – kdo zná odkaz, ten ji uvidí. Nedávejte do ní čísla pasů, rezervační kódy ani přesné adresy, pokud nechcete.

---

## ✏️ Jak aktualizovat obsah během cesty

Jsou dvě cesty. Obě končí tím, že na GitHubu nahradíte soubor `trip-data.json` (případně nahrajete fotky).

### Způsob A – Režim úprav přímo na webu (doporučeno, jde i z mobilu)

1. Otevřete svůj web a úplně dole klikněte na **Režim úprav**
   (nebo otevřete adresu s `?upravy=1`, např. `https://…/japonsko-2026/?upravy=1`).
2. Teď můžete:
   - **odškrtávat aktivity a místa výletů** jako absolvované (klik na kolečko ✔),
   - v detailu dne **přidat aktivitu / navštívené místo** (souřadnice stačí kliknout do mapy),
   - **přidat poznámku** k dni nebo k výletu,
   - **přidat fotku** (viz níže),
   - u výletů **změnit termín a stav** (pevný / naplánováno / podle počasí / nenaplánováno),
   - přejmenovat den.
3. Změny se průběžně ukládají **jen ve vašem prohlížeči** (rodiče je zatím nevidí).
4. Až budete chtít změny zveřejnit, klikněte v modré liště dole na **⬇ Stáhnout trip-data.json**.
5. Na GitHubu v repozitáři: **Add file → Upload files** → nahrajte stažený `trip-data.json` (přepíše starý) → **Commit changes**.
6. Do pár minut se změny objeví na webu.

> Režim úprav může zapnout kdokoli, ale změny zůstanou jen v jeho prohlížeči – na zveřejněný web nemají vliv, dokud se `trip-data.json` nenahraje na GitHub.

**Tlačítka v liště režimu úprav:**

| Tlačítko | Co dělá |
|---|---|
| ⬇ Stáhnout trip-data.json | stáhne aktuální data se všemi úpravami |
| Kopírovat JSON | zkopíruje data do schránky (hodí se pro vložení do editoru na GitHubu) |
| Zahodit změny | smaže lokální úpravy a vrátí zveřejněnou verzi |
| Ukončit | vypne režim úprav (koncept zůstane uložen pro příště) |

### Způsob B – Úprava souboru přímo na GitHubu

1. V repozitáři otevřete `trip-data.json` a klikněte na ✏️ (Edit).
2. Upravte text (viz popis polí níže) a klikněte **Commit changes**.
3. Pozor na čárky a uvozovky – pokud v JSON uděláte chybu, web zobrazí hlášku „V souboru trip-data.json je chyba zápisu“. Kontrolu můžete udělat např. na [jsonlint.com](https://jsonlint.com).

---

## 📷 Fotky

Fotky se ukládají do složky `photos/` a v `trip-data.json` je na ně jen odkaz.

**Z režimu úprav:**
1. V detailu dne → **📷 Přidat fotku** → vyberte fotku z telefonu.
2. Web ji automaticky **zmenší** (max. 1600 px, cca 200–400 kB), **stáhne** pod názvem typu `2026-11-18-103512.jpg` a vyplní cestu `photos/2026-11-18-103512.jpg`.
3. Doplňte popisek a klikněte **Přidat fotku**.
4. Na GitHubu otevřete složku `photos` → **Add file → Upload files** → nahrajte staženou fotku.
5. Nahrajte i nový `trip-data.json` (viz výše).

Dokud fotka na GitHubu není, místo ní se zobrazí „📷 Fotka zatím není nahraná“.

**Ručně:** nahrajte fotku do `photos/` a do dne v `trip-data.json` přidejte:
```json
"photos": [
  { "src": "photos/sensoji.jpg", "caption": "Ráno u Sensó-dži" }
]
```
Místo cesty lze použít i celý odkaz `https://…`.

Ukázkové fotky (`photos/ukazka-*.jpg`) jsou vygenerované ilustrace – po cestě je smažte nebo nahraďte vlastními.

---

## 🗻 Jednodenní výlety

Výlety jsou v `trip-data.json` v sekci `dayTrips`. Výlet **nikdy nemění ubytovací město** – město, ve kterém spíme, se počítá jen ze sekce `bases`.

```json
{
  "id": "fuji",
  "name": "Fuji / Kawaguchiko",
  "baseId": "tokio",              ← výchozí město (id z "bases")
  "date": null,                   ← datum "2026-11-19", nebo null = bez termínu
  "status": "weather",            ← viz tabulka níže
  "candidateDates": ["2026-11-16", "…"],  ← možné dny (zobrazí se v kalendáři poloprůhledně)
  "places": [ { "id": "fuji-1", "name": "Chureito Pagoda", "lat": 35.5011, "lng": 138.8013, "visited": false } ],
  "route": [[35.68, 139.70], …]   ← orientační trasa na mapě (body [šířka, délka])
}
```

| `status` | Zobrazení |
|---|---|
| `fixed` | Pevný termín (např. Miyajima 29. 11.) |
| `planned` | Naplánováno |
| `weather` | „Termín podle počasí“ (pokud je `date` vyplněné: „Předběžně 19. 11. · podle počasí“) |
| `unplanned` | „Zatím nenaplánováno“ |

**Změna termínu:** v režimu úprav u karty výletu vyberte den (nabízí se jen dny, kdy spíme ve výchozím městě), nebo u možného dne v kalendáři klikněte **Naplánovat sem**. Kalendář, denní program, časová osa i přehled výletů se aktualizují automaticky. Ručně stačí změnit `"date"` v JSON.

V den výletu se v kalendáři zobrazí ikona výletu a v denním programu je výlet **hlavní program dne**; ostatní aktivity dne jsou pod ním jako „Další program dne“.

---

## 🗂 Popis `trip-data.json`

| Sekce | Obsah |
|---|---|
| `trip` | název, podtitul, `start` a `end` cesty (RRRR-MM-DD), časová pásma |
| `arrival` / `departure` | přílet a odlet (zobrazení na časové ose a mapě) |
| `bases` | hlavní zastávky s ubytováním: `start` = den příjezdu, `end` = den odjezdu, souřadnice, barva, `hotel` |
| `dayTrips` | jednodenní výlety (viz výše) |
| `days` | program jednotlivých dní: `title`, `activities`, `notes`, `photos` |

**Aktivita:**
```json
{
  "id": "d1116-1",            ← libovolné unikátní ID
  "time": "09:00",            ← nepovinné
  "title": "Chrám Sensó-dži",
  "place": "Asakusa",
  "lat": 35.7148, "lng": 139.7967,   ← nepovinné (bez nich se místo nezobrazí na mapě)
  "type": "pamatka",          ← pamatka | jidlo | doprava | priroda | nakupy | vyhled | jine
  "done": false,              ← true = absolvováno (zelená)
  "note": "nepovinná krátká poznámka"
}
```

**Poznámka:** `{ "time": "21:30", "text": "Dnešek byl skvělý!" }`

**Souřadnice** zjistíte v Google Mapách: pravé tlačítko na místo → první řádek (např. `35.7148, 139.7967`) se zkopíruje.

**Ubytování:** u každého města doplňte `"hotel": "Název hotelu"` – zobrazí se na časové ose.

---

## 🔍 Náhled k jinému datu (test)

Stránka se řídí aktuálním datem v Japonsku. Pro vyzkoušení, jak bude vypadat během cesty, přidejte do adresy:

- `?datum=2026-11-18` – stránka se tváří, jako by bylo 18. 11. 2026,
- `?datum=2026-11-25&demo=1` – navíc ukáže dny před tímto datem jako absolvované (jen zobrazení, data se nemění).

---

## 💻 Spuštění na počítači (nepovinné)

Kvůli načítání `trip-data.json` nestačí otevřít `index.html` dvojklikem. Spusťte ve složce projektu jednoduchý server:

```bash
python -m http.server 8000
```
a otevřete `http://localhost:8000`.
(Alternativně rozšíření **Live Server** ve VS Code.)

---

## ℹ️ Technické poznámky

- Mapa: [Leaflet](https://leafletjs.com) 1.9.3 (BSD-2, přibaleno ve `vendor/leaflet`) a podklady © [OpenStreetMap](https://www.openstreetmap.org/copyright) – zdarma, bez klíče.
- Písma: Google Fonts (zdarma); bez internetu se použije systémové písmo.
- Data se načítají bez cache, takže rodiče po obnovení stránky vidí nejnovější verzi (GitHub Pages může mít zpoždění do ~10 minut).
- Hodiny v hlavičce ukazují čas v Japonsku a v Česku.

## Správa webu přes Codex

Web lze upravovat pomocí Codexu z telefonu, například z iPhonu, bez ručního stahování, úprav a nahrávání souborů. S propojeným GitHubem stačí uvést repozitář `dumaaaaan/Japonsko-2026` a česky popsat požadovanou změnu.

Například: „K 18. listopadu 2026 přidej poznámku: Dnes jsme navštívili Asakusu. Zachovej ostatní program i vzhled a připrav pull request.“ Fotografie přiložte k zadání s datem a popiskem.

Codex zkontroluje změny a podle dostupných oprávnění vytvoří commit a pull request. Po sloučení do `main` web zveřejní GitHub Pages. Existující itinerář, fotografie ani funkce nemažte bez výslovného souhlasu vlastníka. Režim úprav na samotném webu ukládá pouze místní koncept v prohlížeči; Codex ho automaticky nepřebírá.
