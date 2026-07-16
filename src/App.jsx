import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import './App.css'

const MAP_BOUNDS = [[35.4, 51.4], [47.9, 77.2]]

const REGION_META = {
  'UZ-AN': ['Andijon', '#78aa9b'], 'UZ-BU': ['Buxoro', '#78aa9b'],
  'UZ-FA': ['Farg‘ona', '#78aa9b'], 'UZ-JI': ['Jizzax', '#78aa9b'],
  'UZ-NG': ['Namangan', '#78aa9b'], 'UZ-NW': ['Navoiy', '#78aa9b'],
  'UZ-QA': ['Qashqadaryo', '#78aa9b'], 'UZ-QR': ['Qoraqalpog‘iston', '#78aa9b'],
  'UZ-SA': ['Samarqand', '#78aa9b'], 'UZ-SI': ['Sirdaryo', '#78aa9b'],
  'UZ-SU': ['Surxondaryo', '#78aa9b'], 'UZ-TK': ['Toshkent shahri', '#78aa9b'],
  'UZ-TO': ['Toshkent viloyati', '#78aa9b'], 'UZ-XO': ['Xorazm', '#78aa9b'],
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
    if (region || district) map.flyToBounds(bounds, {
      duration: district ? 1.25 : 1.55,
      easeLinearity: 0.12,
      maxZoom: district ? 12 : 10,
      padding: district ? [18, 18] : [26, 26],
    })
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
  const [neighbors, setNeighbors] = useState(null)
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
      fetch(`${base}data/neighboring-countries.geojson`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Qo‘shni davlatlar fayli topilmadi'))),
    ]).then(([adm1, adm2, nearby]) => {
      setRegions(adm1)
      setDistricts({ ...adm2, features: attachParents(adm2.features, adm1.features) })
      setNeighbors(nearby)
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
    const active = regionISO === iso
    const muted = Boolean(regionISO && !active)
    return {
      color: theme === 'dark' ? '#315f7a' : '#0b3554',
      weight: active ? 3.6 : hoverISO === iso ? 3 : 2,
      opacity: muted ? .38 : 1,
      fillColor: active ? '#91c4b4' : '#78aa9b',
      fillOpacity: muted ? .18 : hoverISO === iso ? .88 : .72,
      className: `region-shape${active ? ' region-selected' : ''}${muted ? ' region-muted' : ''}${active && districtID ? ' region-under-focus' : ''}`,
    }
  }
  const districtStyle = (feature) => {
    const active = districtID === feature.properties.shapeID
    const muted = Boolean(districtID && !active)
    return {
      color: theme === 'dark' ? '#3e718b' : '#092f4d',
      weight: active ? 3.8 : 1.5,
      opacity: muted ? .3 : 1,
      fillColor: active ? '#a9d7c5' : '#82b3a4',
      fillOpacity: muted ? .16 : active ? .95 : .5,
      className: `district-shape${active ? ' district-selected' : ''}${muted ? ' district-muted' : ''}`,
    }
  }

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
        {error ? <div className="status-card error"><strong>Xarita ochilmadi</strong><span>{error}</span></div> : !regions || !districts || !neighbors ? <div className="status-card"><span className="loader" /><strong>Lokal xarita yuklanmoqda…</strong></div> : <>
          <MapContainer center={[41.25, 64.6]} zoom={5} minZoom={4} maxZoom={12} maxBounds={MAP_BOUNDS} maxBoundsViscosity={.72} zoomControl={false} attributionControl={false} zoomSnap={.25} zoomAnimation fadeAnimation className="map">
            <ZoomControl position="bottomright" /><MapMotion country={regions} region={region} district={district} />
            <GeoJSON key={`mask-${theme}`} data={mask} interactive={false} style={{ color: theme === 'dark' ? '#071317' : '#667476', weight: 1, fillColor: theme === 'dark' ? '#040b0e' : '#aeb8b7', fillOpacity: theme === 'dark' ? .92 : .9, fillRule: 'evenodd', className: 'outside-mask' }} />
            <GeoJSON
              key={`neighbors-${theme}`}
              data={neighbors}
              interactive={false}
              style={{
                color: theme === 'dark' ? '#426075' : '#294f68',
                weight: 1.5,
                opacity: .46,
                fillColor: theme === 'dark' ? '#26383e' : '#bac4c1',
                fillOpacity: theme === 'dark' ? .34 : .4,
                className: 'neighbor-country',
              }}
              onEachFeature={(feature, layer) => layer.bindTooltip(feature.properties.shapeName, { permanent: true, direction: 'center', className: 'country-label' })}
            />
            <GeoJSON key={`r-${theme}-${regionISO}-${hoverISO}`} data={regions} style={regionStyle} onEachFeature={(feature, layer) => { const meta = getMeta(feature); layer.bindTooltip(meta.name, { permanent: !regionISO, direction: 'center', className: 'region-label' }); if (feature.properties.shapeISO === regionISO) layer.on('add', () => layer.bringToFront()); layer.on({ click: () => chooseRegion(feature.properties.shapeISO), mouseover: () => setHoverISO(feature.properties.shapeISO), mouseout: () => setHoverISO(null) }) }} />
            {districtSet && <GeoJSON key={`d-${theme}-${regionISO}-${districtID}`} data={districtSet} style={districtStyle} onEachFeature={(feature, layer) => { layer.bindTooltip(feature.properties.shapeName, { sticky: true, className: 'district-tooltip' }); if (feature.properties.shapeID === districtID) layer.on('add', () => layer.bringToFront()); layer.on('click', () => setDistrictID(feature.properties.shapeID)) }} />}
          </MapContainer>
          <div className="map-caption"><span className="caption-icon"><Icon name="locate" /></span><div><small>{district ? 'TANLANGAN TUMAN' : region ? 'TANLANGAN HUDUD' : 'INTERAKTIV XARITA'}</small><strong>{district?.properties.shapeName ?? regionName ?? '14 ma’muriy hudud'}</strong></div></div>
          <div className="map-legend"><span><i className="legend-country" />O‘zbekiston</span><span><i className="legend-outside" />Chegara tashqarisi</span></div>
        </>}
      </div>
    </section>
  </main>
}

export default App
