# UZMAP — O‘zbekiston offline interaktiv xaritasi

UZMAP — O‘zbekistonning birinchi va ikkinchi darajali ma’muriy hududlarini ko‘rsatadigan, React va Leaflet asosida yozilgan interaktiv veb-xarita. Viloyat yoki respublika darajasidagi hudud tanlanganda xarita silliq animatsiya bilan markazlashadi va shu hududga tegishli tuman hamda shaharlar ochiladi.

**Live demo:** [uzmap-offline.vercel.app](https://uzmap-offline.vercel.app)

> Muhim: O‘zbekistonda birinchi darajadagi **14 ta ma’muriy birlik** bor: 12 viloyat, Qoraqalpog‘iston Respublikasi va Toshkent shahri. Shuning uchun ilovada ba’zan aytiladigan “13 viloyat” emas, geografik ma’lumotdagi barcha 14 hudud ko‘rsatilgan.

## Tayyor imkoniyatlar

- O‘zbekistonning barcha 14 ta ADM1 hududi sokin yashil fill va ko‘k chegaralarda;
- xarita ustidagi responsive navbar, viloyat va tuman dropdown selectorlari;
- local SVG tekstura orqali yo‘l, suv va relyefga o‘xshash fon chiziqlari;
- tanlangan hududga `flyToBounds` orqali silliq yaqinlashish;
- hudud tanlangach ADM2 — tuman va shahar chegaralarini ko‘rsatish;
- tumanni bosganda yana silliq markazlashish;
- tanlangan viloyat yoki tuman tashqarisini geometriyaga mos qorong‘i spotlight/blur bilan xiralashtirish;
- tumanlarni yashil rang palitrasi, neon-ko‘k chegara va tanlangan hududda glow bilan ko‘rsatish;
- O‘zbekiston tashqarisini xira/blur maska bilan yopish;
- besh qo‘shni davlat konturini lokal, xira va blur fon qatlamida ko‘rsatish;
- dark va light rejim, tanlovni `localStorage`da saqlash;
- desktop, planshet va telefon uchun responsive interfeys;
- tashqi tile server yoki xarita API kalitisiz ishlash;
- PWA service worker orqali birinchi ochilishdan keyin internet uzilganda ham qayta ishlash;
- klaviatura fokusi, reduced-motion va holat indikatorlari.

## Texnologiyalar va o‘rnatilgan paketlar

| Paket | Vazifasi |
| --- | --- |
| `react`, `react-dom` | UI va komponent holatini boshqarish |
| `vite` | local development va production build |
| `leaflet` | xaritani chizish, bounds va animatsiya |
| `react-leaflet` | Leaflet qatlamlarini React ichida boshqarish |
| `@turf/point-on-feature` | har bir tuman ichidan xavfsiz nuqta olish |
| `@turf/boolean-point-in-polygon` | tumanni tegishli viloyat bilan avtomatik bog‘lash |
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

`npm run build` natijasi `dist/` ichiga yoziladi. Vercel uchun framework preset — **Vite**, build command — `npm run build`, output directory — `dist`.

## Loyiha qanday ketma-ketlikda ishlaydi?

1. `src/main.jsx` React ilovasini yuklaydi va Leaflet CSS’ini ulaydi.
2. `App.jsx` ishga tushganda `public/data` ichidagi ADM1 va ADM2 GeoJSON fayllarni `fetch` qiladi. Bu so‘rov internetga emas, shu saytning lokal statik fayllariga boradi.
3. Turf har bir tumandagi ishonchli ichki nuqtani topadi va qaysi ADM1 poligon ichiga tushganini tekshiradi. Natijada 199 ta ADM2 obyekt ota hududi bilan bog‘lanadi.
4. ADM1 poligonlar asosida “teskari maska” yaratiladi: dunyo to‘rtburchagi ichidan O‘zbekiston geometriyasi teshik sifatida kesib olinadi. Maskaga xira rang va blur beriladi.
5. Bosh ekranda 14 hudud yagona sokin rang, ko‘k chegara va label bilan chiziladi.
6. Foydalanuvchi hududni bossa, React tanlangan ISO kodini saqlaydi. `MapMotion` kerakli bounds’ni hisoblab, `flyToBounds` animatsiyasini boshlaydi.
7. Faqat tanlangan hududning tumanlari filtrlanib yangi GeoJSON qatlamida ko‘rsatiladi.
8. Tuman bosilganda uning geometriyasiga yana yaqinlashadi; navbar selectorlari va xarita statusi tanlov bilan birga yangilanadi.
9. Theme tugmasi CSS variable’larni almashtiradi; tanlov keyingi ochilish uchun `localStorage`da qoladi.
10. Production build vaqtida PWA plugin barcha JS, CSS, HTML, SVG va GeoJSON fayllarni service worker precache ro‘yxatiga kiritadi.

## Papkalar tuzilishi

```text
uz-map/
├─ public/
│  ├─ data/
│  │  ├─ uzbekistan-adm1.geojson       # 14 hudud
│  │  ├─ uzbekistan-adm2.geojson       # 199 tuman/shahar
│  │  └─ neighboring-countries.geojson # 5 qo‘shni davlat
│  └─ favicon.svg
├─ src/
│  ├─ App.jsx                      # xarita logikasi va UI
│  ├─ App.css                      # full-screen xarita/navbar responsive dizayni
│  ├─ index.css                    # theme tokenlari va global CSS
│  └─ main.jsx                     # React entry point
├─ index.html
├─ package.json
└─ vite.config.js                  # Vite va PWA konfiguratsiyasi
```

## Offline rejim qanday ishlaydi?

Xarita raster tile ishlatmaydi. Ya’ni OpenStreetMap, Google Maps, Mapbox yoki boshqa internet serveriga so‘rov yubormaydi. Chegaralar repository ichidagi GeoJSON’dan chiziladi.

- `npm run dev` lokal kompyuterda internet talab qilmaydi;
- production sayti **birinchi marta internet bilan to‘liq ochilishi kerak**;
- birinchi ochilishdan so‘ng service worker fayllarni cache qiladi;
- keyingi reload va qayta ochilishlarda xarita offline ishlaydi;
- brauzer site data/cache’ni tozalasa, bir marta yana internet bilan ochish kerak.

Bu versiyada ko‘cha, bino va yo‘l rastrlari ataylab yo‘q. Ularni offline qo‘shish uchun MBTiles/PMTiles yoki lokal tile paket kerak bo‘ladi va build hajmi ancha kattalashadi. Hozirgi yechim ma’muriy chegaralar uchun tez va to‘liq lokal.

## GeoJSON manbasi va litsenziya

Chegaralar [geoBoundaries](https://www.geoboundaries.org/) gbOpen datasetidan olingan.

- ADM1: Open Data Commons Open Database License 1.0;
- ADM2: Creative Commons Attribution 3.0 IGO;
- lokal fayllar: `public/data/uzbekistan-adm1.geojson` va `public/data/uzbekistan-adm2.geojson`.

Ma’muriy nomlar manbada ingliz tilida bo‘lishi mumkin. ADM1 nomlari UI’da o‘zbekchalashtirilgan, ADM2 nomlari esa datasetdagi nom bilan ko‘rsatiladi.

## O‘zgartirish bo‘yicha sodda yo‘l

- Ranglarni almashtirish: `src/App.jsx` ichidagi `REGION_META`.
- Hudud nomini almashtirish: shu obyekt ichidagi birinchi qiymat.
- Animatsiya tezligini almashtirish: `MapMotion` ichidagi `duration`.
- Dark/light ranglarini almashtirish: `src/index.css` ichidagi `:root` va `[data-theme='dark']`.
- Navbar, dropdown, xarita fon teksturasi va mobile layout: `src/App.css`.
- Yangi GeoJSON ishlatish: eski fayl nomlarini saqlagan holda `public/data` ichidagi fayllarni almashtirish; property formatlari boshqacha bo‘lsa `shapeISO`, `shapeID`, `shapeName` mappingini ham yangilash.

## Ma’lum cheklovlar

- Xarita siyosiy/ma’muriy vizualizatsiya bo‘lib, navigatsiya uchun mo‘ljallanmagan.
- ADM2 datasetdagi ayrim birliklar “city” sifatida berilgan; ular tumanlar bilan bir qatorda ko‘rsatiladi.
- Tumanlar ota hududga geometriyadagi ichki nuqta orqali biriktiriladi. Juda noodatiy yoki noto‘g‘ri geometriya kiritilsa, mappingni qo‘lda tekshirish kerak.
- Offline cache faqat HTTPS yoki localhost’da ishlaydi; Vercel avtomatik HTTPS beradi.

## Deploy

GitHub’ga push qilingandan keyin Vercel’da repository’ni import qilish yoki CLI orqali deploy qilish mumkin:

```bash
npx vercel --prod
```

Tavsiya etilgan loyiha nomi: `uzmap-offline`.

---

React + Leaflet + lokal GeoJSON. API kaliti va tile server talab qilinmaydi.
