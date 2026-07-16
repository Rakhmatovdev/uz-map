import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import './App.css'

const MAP_BOUNDS = [[35.4, 51.4], [47.9, 77.2]]

const REGION_META = {
  'UZ-AN': ['Andijon', '#29b6a6'], 'UZ-BU': ['Buxoro', '#f2a93b'],
  'UZ-FA': ['Farg‘ona', '#ee6c8a'], 'UZ-JI': ['Jizzax', '#8b7cf6'],
  'UZ-NG': ['Namangan', '#39a7e8'], 'UZ-NW': ['Navoiy', '#d18b52'],
  'UZ-QA': ['Qashqadaryo', '#d75ad5'], 'UZ-QR': ['Qoraqalpog‘iston', '#5b8def'],
  'UZ-SA': ['Samarqand', '#ec7b3e'], 'UZ-SI': ['Sirdaryo', '#50b86b'],
  'UZ-SU': ['Surxondaryo', '#e75a50'], 'UZ-TK': ['Toshkent shahri', '#f0c33c'],
  'UZ-TO': ['Toshkent viloyati', '#3cc4df'], 'UZ-XO': ['Xorazm', '#83b94a'],
}

// Datasetdagi uchta chegara/enklav geometriyasi ADM1 bilan to‘liq ustma-ust
// tushmaydi, shuning uchun ularning rasmiy ota hududi aniq ko‘rsatiladi.
const DISTRICT_PARENT_FALLBACK = {
  Khazarasp: 'UZ-XO',
  Sokh: 'UZ-FA',
  'Shirin city': 'UZ-SI',
}

const getMeta = (feature) => {
  const [name, color] = REGION_META[feature?.properties.shapeISO] ?? [feature?.properties.shapeName, '#4da8da']
  return { name, color }
}

function initialTheme() {
  const saved = localStorage.getItem('uzmap-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function outsideMask(features) {
  const holes = []
  features.forEach(({ geometry }) => {
    if (geometry.type === 'Polygon') holes.push(geometry.coordinates[0])
    else geometry.coordinates.forEach((polygon) => holes.push(polygon[0]))
  })
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [
    [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes,
  ] } }
}

function attachParents(districts, regions) {
  return districts.map((district) => {
    const point = pointOnFeature(district)
    const parent = regions.find((region) => booleanPointInPolygon(point, region))
    return { ...district, properties: { ...district.properties, parentISO: parent?.properties.shapeISO ?? DISTRICT_PARENT_FALLBACK[district.properties.shapeName] ?? null } }
  })
}

function MapMotion({ country, region, district }) {
  const map = useMap()
  useEffect(() => {
    const target = district ?? region ?? country
    if (!target) return
    const bounds = L.geoJSON(target).getBounds()
    if (region || district) map.flyToBounds(bounds, { duration: district ? 1 : 1.45, easeLinearity: 0.16, maxZoom: district ? 9 : 7.5, padding: [52, 52] })
    else map.fitBounds(bounds, { animate: false, padding: [40, 40] })
  }, [country, district, map, region])
  return null
}

function Icon({ name }) {
  const paths = {
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
    layers: <><path d="m12 2-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [regions, setRegions] = useState(null)
  const [districts, setDistricts] = useState(null)
  const [regionISO, setRegionISO] = useState(null)
  const [districtID, setDistrictID] = useState(null)
  const [hoverISO, setHoverISO] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('uzmap-theme', theme)
  }, [theme])

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}data/uzbekistan-adm1.geojson`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Viloyatlar fayli topilmadi'))),
      fetch(`${base}data/uzbekistan-adm2.geojson`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Tumanlar fayli topilmadi'))),
    ]).then(([adm1, adm2]) => {
      setRegions(adm1)
      setDistricts({ ...adm2, features: attachParents(adm2.features, adm1.features) })
    }).catch((reason) => setError(reason.message))
  }, [])

  const region = useMemo(() => regions?.features.find((f) => f.properties.shapeISO === regionISO) ?? null, [regionISO, regions])
  const districtSet = useMemo(() => districts && regionISO ? { ...districts, features: districts.features.filter((f) => f.properties.parentISO === regionISO) } : null, [districts, regionISO])
  const district = useMemo(() => districtSet?.features.find((f) => f.properties.shapeID === districtID) ?? null, [districtID, districtSet])
  const mask = useMemo(() => regions ? outsideMask(regions.features) : null, [regions])
  const ordered = useMemo(() => regions ? [...regions.features].sort((a, b) => getMeta(a).name.localeCompare(getMeta(b).name, 'uz')) : [], [regions])

  const chooseRegion = (iso) => { setDistrictID(null); setRegionISO(iso) }
  const reset = () => { setDistrictID(null); setRegionISO(null) }
  const regionName = region ? getMeta(region).name : null

  const regionStyle = (feature) => {
    const iso = feature.properties.shapeISO
    return { color: theme === 'dark' ? '#dbe9ec' : '#fff', weight: regionISO === iso ? 3 : hoverISO === iso ? 2.5 : 1.4,
      fillColor: getMeta(feature).color, fillOpacity: regionISO ? (regionISO === iso ? .88 : .1) : hoverISO === iso ? .96 : .78, className: 'region-shape' }
  }
  const districtStyle = (feature) => ({ color: theme === 'dark' ? '#dcf5f2' : '#174a51', weight: districtID === feature.properties.shapeID ? 2.8 : 1.1,
    fillColor: districtID === feature.properties.shapeID ? '#ffd166' : getMeta(region).color, fillOpacity: districtID === feature.properties.shapeID ? .92 : .34, className: 'district-shape' })

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={reset} aria-label="Bosh xaritaga qaytish"><span className="brand-mark"><Icon name="layers" /></span><span><strong>UZMAP</strong><small>O‘zbekiston ma’muriy xaritasi</small></span></button>
      <div className="topbar-actions"><span className="offline-badge"><i />100% offline</span><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Rang rejimini almashtirish"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button></div>
    </header>
    <section className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">HUDUDLAR KATALOGI</span><h1>{regionName ?? 'O‘zbekiston'}</h1><p>{regionName ? `${districtSet?.features.length ?? 0} ta tuman va shahar. Xaritada hududni tanlang.` : 'Viloyatni tanlang — xarita avtomatik yaqinlashib, tumanlar kesimini ochadi.'}</p></div>
        {region ? <div className="district-panel">
          <button className="back-button" onClick={reset}><Icon name="back" />Barcha hududlar</button>
          <div className="panel-stat"><span style={{ background: getMeta(region).color }} /><div><strong>{regionName}</strong><small>{districtSet?.features.length ?? 0} ma’muriy birlik</small></div></div>
          <div className="district-list">{districtSet?.features.slice().sort((a, b) => a.properties.shapeName.localeCompare(b.properties.shapeName)).map((item, i) => <button className={districtID === item.properties.shapeID ? 'active' : ''} key={item.properties.shapeID} onClick={() => setDistrictID(item.properties.shapeID)}><span>{String(i + 1).padStart(2, '0')}</span>{item.properties.shapeName}</button>)}</div>
        </div> : <div className="region-list">{ordered.map((item, i) => { const meta = getMeta(item); return <button key={item.properties.shapeISO} onClick={() => chooseRegion(item.properties.shapeISO)} onMouseEnter={() => setHoverISO(item.properties.shapeISO)} onMouseLeave={() => setHoverISO(null)}><span className="region-index">{String(i + 1).padStart(2, '0')}</span><i style={{ background: meta.color }} /><strong>{meta.name}</strong><span className="chevron">›</span></button> })}</div>}
        <footer className="sidebar-footer"><span><i />Tarmoq talab qilinmaydi</span><small>Chegaralar: geoBoundaries</small></footer>
      </aside>
      <div className="map-shell">
        {error ? <div className="status-card error"><strong>Xarita ochilmadi</strong><span>{error}</span></div> : !regions || !districts ? <div className="status-card"><span className="loader" /><strong>Lokal xarita yuklanmoqda…</strong></div> : <>
          <MapContainer center={[41.25, 64.6]} zoom={5} minZoom={4} maxZoom={11} maxBounds={MAP_BOUNDS} maxBoundsViscosity={.72} zoomControl={false} attributionControl={false} zoomSnap={.25} className="map">
            <ZoomControl position="bottomright" /><MapMotion country={regions} region={region} district={district} />
            <GeoJSON key={`mask-${theme}`} data={mask} interactive={false} style={{ color: theme === 'dark' ? '#0b171a' : '#8e9b9c', weight: 1, fillColor: theme === 'dark' ? '#071013' : '#d6dcdb', fillOpacity: theme === 'dark' ? .84 : .8, fillRule: 'evenodd', className: 'outside-mask' }} />
            <GeoJSON key={`r-${theme}-${regionISO}-${hoverISO}`} data={regions} style={regionStyle} onEachFeature={(feature, layer) => { const meta = getMeta(feature); layer.bindTooltip(meta.name, { permanent: !regionISO, direction: 'center', className: 'region-label' }); layer.on({ click: () => chooseRegion(feature.properties.shapeISO), mouseover: () => setHoverISO(feature.properties.shapeISO), mouseout: () => setHoverISO(null) }) }} />
            {districtSet && <GeoJSON key={`d-${theme}-${regionISO}-${districtID}`} data={districtSet} style={districtStyle} onEachFeature={(feature, layer) => { layer.bindTooltip(feature.properties.shapeName, { sticky: true, className: 'district-tooltip' }); layer.on('click', () => setDistrictID(feature.properties.shapeID)) }} />}
          </MapContainer>
          <div className="map-caption"><span className="caption-icon"><Icon name="locate" /></span><div><small>{district ? 'TANLANGAN TUMAN' : region ? 'TANLANGAN HUDUD' : 'INTERAKTIV XARITA'}</small><strong>{district?.properties.shapeName ?? regionName ?? '14 ma’muriy hudud'}</strong></div></div>
          <div className="map-legend"><span><i className="legend-country" />O‘zbekiston</span><span><i className="legend-outside" />Chegara tashqarisi</span></div>
        </>}
      </div>
    </section>
  </main>
}

export default App
