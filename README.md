# UZMAP — O‘zbekiston offline interaktiv xaritasi

UZMAP — O‘zbekistonning ko‘chalari, binolari va birinchi/ikkinchi darajali ma’muriy hududlarini ko‘rsatadigan React, MapLibre GL JS va PMTiles asosidagi offline interaktiv xarita. Viloyat yoki tuman tanlanganda xarita silliq animatsiya bilan markazlashadi.

> Muhim: O‘zbekistonda birinchi darajadagi **14 ta ma’muriy birlik** bor: 12 viloyat, Qoraqalpog‘iston Respublikasi va Toshkent shahri. Shuning uchun ilovada ba’zan aytiladigan “13 viloyat” emas, geografik ma’lumotdagi barcha 14 hudud ko‘rsatilgan.

## Tayyor imkoniyatlar

- O‘zbekistonning barcha 14 ta ADM1 hududi sokin yashil fill va ko‘k chegaralarda;
- xarita ustidagi responsive navbar, viloyat va tuman dropdown selectorlari;
- lokal PMTiles bazasidan haqiqiy OSM ko‘chalari, binolar, suvlar, parklar va joy nomlari;
- tanlangan hududga MapLibre `fitBounds` animatsiyasi orqali silliq yaqinlashish;
- hudud tanlangach ADM2 — tuman va shahar chegaralarini ko‘rsatish;
- tuman tanlanganda uni aniq ajratish va viloyatning qolgan tumanlarini ekranda saqlash;
- tanlangan viloyat tashqarisini geometriyaga mos qorong‘i spotlight bilan xiralashtirish;
- tumanlarni yashil rang palitrasi, neon-ko‘k chegara va tanlangan hududda glow bilan ko‘rsatish;
- O‘zbekiston tashqarisini xira/blur maska bilan yopish;
- besh qo‘shni davlatning faqat lokal, xira konturini ko‘rsatish; ularning ko‘chalari opaque maska bilan yashiriladi;
- dark va light rejim, tanlovni `localStorage`da saqlash;
- desktop, planshet va telefon uchun responsive interfeys;
- tashqi tile server yoki xarita API kalitisiz ishlash;
- lokal PMTiles va PWA app shell orqali internet uzilganda ham ishlash;
- klaviatura fokusi, reduced-motion va holat indikatorlari.

## Texnologiyalar va o‘rnatilgan paketlar

| Paket | Vazifasi |
| --- | --- |
| `react`, `react-dom` | UI va komponent holatini boshqarish |
| `vite` | local development va production build |
| `maplibre-gl` | WebGL xarita, vektor qatlamlar, bounds va animatsiya |
| `pmtiles` | 227 MB lokal OSM vector tile arxivini Range Request bilan o‘qish |
| `@turf/point-on-feature` | har bir tuman ichidan xavfsiz nuqta olish |
| `@turf/boolean-point-in-polygon` | tumanni tegishli viloyat bilan avtomatik bog‘lash |
| `@turf/union` | ADM2 tumanlaridan tashqi ADM1 konturini 1:1 hosil qilish |
| `vite-plugin-pwa` | app shell va GeoJSON fayllarni offline cache qilish |
| `oxlint` | kodni statik tekshirish |

## Ishga tushirish

Talablar: Node.js 20+ va npm.

```bash
git clone https://github.com/Rakhmatovdev/uz-map.git
cd uz-map
npm install
npm run dev
```

Terminal ko‘rsatgan lokal manzilni brauzerda oching. Odatda bu `http://localhost:5173` bo‘ladi.

Production tekshiruvi:

```bash
npm run lint
npm run build
npm run preview
```

`npm run build` natijasi `dist/` ichiga yoziladi. Joriy versiya lokal foydalanish uchun tayyorlangan va avtomatik deploy qilinmagan.

## Loyiha qanday ketma-ketlikda ishlaydi?

1. `src/main.jsx` React ilovasini va MapLibre GL CSS’ini yuklaydi.
2. `App.jsx` ishga tushganda `public/data` ichidagi ADM1 va ADM2 GeoJSON fayllarni `fetch` qiladi. Bu so‘rov internetga emas, shu saytning lokal statik fayllariga boradi.
3. `map-config.json` PMTiles manzilini beradi. MapLibre faylni birdan RAM’ga yuklamaydi: kerakli tile bo‘laklarini lokal HTTP Range Request orqali o‘qiydi.
4. Turf har bir tumandagi ishonchli ichki nuqtani topadi va qaysi ADM1 poligon ichiga tushganini tekshiradi. Natijada 199 ta ADM2 obyekt ota hududi bilan bog‘lanadi.
5. Bir viloyatga tegishli ADM2 poligonlar birlashtirilib, ko‘rsatiladigan ADM1 konturi hosil qilinadi. Shu sabab tashqi viloyat chizig‘i tuman qirralariga 1:1 tushadi.
6. Hosil qilingan viloyat poligonlari asosida “teskari maska” yaratiladi: dunyo to‘rtburchagi ichidan tanlangan hudud geometriyasi teshik sifatida kesib olinadi. Tashqi qism xiralashtiriladi.
7. Bosh ekranda 14 hudud sokin rang, to‘q-ko‘k chegara va label bilan MapLibre WebGL qatlamlarida chiziladi.
8. Foydalanuvchi viloyatni bossa, MapLibre uning bounds’iga silliq yaqinlashadi va tegishli ADM2 tumanlari ko‘rsatiladi.
9. Tuman tanlanganda kamera viloyat ko‘lamini saqlaydi, tanlangan tuman glow va aniq kontur bilan ajraladi, qolgan tumanlar va ularning nomlari ko‘rinib turadi. Maydon, koordinata hamda ADM2 ID kartasi ochiladi.
10. Theme tugmasi dark/light xarita style’ini va UI ranglarini almashtiradi; tanlov `localStorage`da qoladi.
11. Production build vaqtida PWA plugin app shell, GeoJSON va lokal shrift glyph fayllarini cache ro‘yxatiga kiritadi. Katta PMTiles fayli esa Range Request bilan to‘g‘ridan-to‘g‘ri o‘qiladi.

## Papkalar tuzilishi

```text
uz-map/
├─ public/
│  ├─ data/
│  │  ├─ uzbekistan-adm1.geojson       # 14 hudud
│  │  ├─ uzbekistan-adm2.geojson       # 199 tuman/shahar
│  │  └─ neighboring-countries.geojson # 5 qo‘shni davlat
│  ├─ offline/
│  │  └─ uzbekistan-streets.pmtiles     # 227 MB lokal OSM ko‘cha bazasi
│  ├─ fonts/                             # lokal xarita label glyph fayllari
│  └─ favicon.svg
├─ src/
│  ├─ App.jsx                      # ma’lumot, tanlov va UI holati
│  ├─ App.css                      # full-screen xarita/navbar responsive dizayni
│  ├─ MapLibreMap.jsx              # WebGL xarita va interaktiv qatlamlar
│  ├─ mapStyle.js                  # dark/light lokal OSM style
│  ├─ offlineStore.js              # ixtiyoriy IndexedDB saqlash
│  ├─ index.css                    # theme tokenlari va global CSS
│  └─ main.jsx                     # React entry point
├─ scripts/
│  └─ build_offline_packages.py    # PMTiles paket tayyorlash yordamchisi
├─ index.html
├─ package.json
└─ vite.config.js                  # Vite va PWA konfiguratsiyasi
```

## Offline rejim qanday ishlaydi?

Xarita tashqi tile server ishlatmaydi. Viloyat va tuman chegaralari lokal GeoJSON’dan, ko‘cha, bino, suv, park va joy nomlari esa lokal PMTiles arxividan chiziladi.

PMTiles kvadrat tile’lardan iborat bo‘lgani sababli chegara tile’larida qo‘shni davlat yo‘lining kichik bo‘lagi bo‘lishi mumkin. Ilova ADM2 tumanlaridan birlashtirilgan aniq hudud geometriyasidan opaque maska yaratib, bunday tashqi ko‘chalarni ko‘rsatmaydi. Qo‘shni davlatlarda faqat yengil GeoJSON fon va chegara konturi qoladi.

Lokal ko‘cha fayli: `public/offline/uzbekistan-streets.pmtiles`.

- source MBTiles hajmi: 293,675,008 bayt — 280.07 MiB;
- PMTiles v3 hajmi: 238,047,871 bayt — 227.02 MiB;
- 416,456 ta addressed vector tile;
- zoom darajalari: 0–14, yuqori zoomlarda MapLibre overzoom qiladi;
- format: MVT/PBF, gzip compression;
- fayl Git’ga kiritilmaydi, shu kompyuterning `public/offline/` papkasida saqlanadi;
- build qilinganda Vite uni `dist/offline/` ichiga nusxalaydi.

- `npm run dev` lokal kompyuterda internet talab qilmaydi;
- kompyuterni internetdan uzib, localhost sahifasini qayta ochish mumkin;
- `public/offline/uzbekistan-streets.pmtiles` o‘chirilsa, ko‘cha fon qatlami ishlamaydi;
- PMTiles faylini `file://` orqali emas, `npm run dev` yoki `npm run preview` serveri orqali ochish kerak.

Ko‘cha bazasi OpenStreetMap Shortbread vector tile schema’iga asoslangan. OSM’da mavjud bo‘lmagan yangi yoki mahalliy obyektlar xaritada chiqmasligi mumkin.

## GeoJSON manbasi va litsenziya

Chegaralar [geoBoundaries](https://www.geoboundaries.org/) gbOpen datasetidan olingan.

- ADM1: Open Data Commons Open Database License 1.0;
- ADM2: Creative Commons Attribution 3.0 IGO;
- lokal fayllar: `public/data/uzbekistan-adm1.geojson` va `public/data/uzbekistan-adm2.geojson`.

Ma’muriy nomlar manbada ingliz tilida bo‘lishi mumkin. ADM1 nomlari UI’da o‘zbekchalashtirilgan, ADM2 nomlari esa datasetdagi nom bilan ko‘rsatiladi.

## O‘zgartirish bo‘yicha sodda yo‘l

- Hudud nomini almashtirish: `src/App.jsx` ichidagi `REGION_NAMES`.
- Xarita ranglari va OSM qatlamlarini almashtirish: `src/mapStyle.js`.
- Hudud/tuman ranglari va animatsiya tezligini almashtirish: `src/MapLibreMap.jsx`.
- Dark/light ranglarini almashtirish: `src/index.css` ichidagi `:root` va `[data-theme='dark']`.
- Navbar, dropdown va mobile layout: `src/App.css`.
- Yangi GeoJSON ishlatish: eski fayl nomlarini saqlagan holda `public/data` ichidagi fayllarni almashtirish; property formatlari boshqacha bo‘lsa `shapeISO`, `shapeID`, `shapeName` mappingini ham yangilash.

## Ma’lum cheklovlar

- Xarita siyosiy/ma’muriy vizualizatsiya bo‘lib, navigatsiya uchun mo‘ljallanmagan.
- ADM2 datasetdagi ayrim birliklar “city” sifatida berilgan; ular tumanlar bilan bir qatorda ko‘rsatiladi.
- Tumanlar ota hududga geometriyadagi ichki nuqta orqali biriktiriladi. Juda noodatiy yoki noto‘g‘ri geometriya kiritilsa, mappingni qo‘lda tekshirish kerak.
- Service worker va brauzer storage funksiyalari localhost yoki HTTPS’da ishlaydi.
- Ko‘cha ma’lumoti OSM snapshot holatida; keyingi yo‘l o‘zgarishlari uchun PMTiles paketni qayta yaratish kerak.

---

React + MapLibre GL JS + PMTiles + lokal GeoJSON. API kaliti va tile server talab qilinmaydi.
