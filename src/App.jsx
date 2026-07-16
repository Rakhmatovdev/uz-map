import { useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, MapContainer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import './App.css'

const MAP_BOUNDS = [[35.4, 51.4], [47.9, 77.2]]
const REGION_NAMES = {
  'UZ-AN': 'Andijon viloyati', 'UZ-BU': 'Buxoro viloyati',
  'UZ-FA': 'Farg‘ona viloyati', 'UZ-JI': 'Jizzax viloyati',
  'UZ-NG': 'Namangan viloyati', 'UZ-NW': 'Navoiy viloyati',
  'UZ-QA': 'Qashqadaryo viloyati', 'UZ-QR': 'Qoraqalpog‘iston Respublikasi',
  'UZ-SA': 'Samarqand viloyati', 'UZ-SI': 'Sirdaryo viloyati',
  'UZ-SU': 'Surxondaryo viloyati', 'UZ-TK': 'Toshkent shahri',
  'UZ-TO': 'Toshkent viloyati', 'UZ-XO': 'Xorazm viloyati',
}
const COUNTRY_NAMES = { KAZ: 'Qozog‘iston', KGZ: 'Qirg‘iziston', TJK: 'Tojikiston', TKM: 'Turkmaniston', AFG: 'Afg‘oniston' }
const DISTRICT_PARENT_FALLBACK = { Khazarasp: 'UZ-XO', Sokh: 'UZ-FA', 'Shirin city': 'UZ-SI' }
const DISTRICT_COLORS = ['#18c956', '#24d967', '#16b94e', '#34e176', '#20c866', '#42d879']

const regionName = (feature) => REGION_NAMES[feature?.properties.shapeISO] ?? feature?.properties.shapeName ?? ''

function featureColor(feature) {
  const seed = [...feature.properties.shapeID].reduce((total, letter) => total + letter.charCodeAt(0), 0)
  return DISTRICT_COLORS[seed % DISTRICT_COLORS.length]
}

function initialTheme() {
  const saved = localStorage.getItem('uzmap-theme')
  return saved === 'light' || saved === 'dark' ? saved : 'dark'
}

function makeOutsideMask(features) {
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
    const parent = regions.find((region) => booleanPointInPolygon(pointOnFeature(district), region))
    return { ...district, properties: { ...district.properties, parentISO: parent?.properties.shapeISO ?? DISTRICT_PARENT_FALLBACK[district.properties.shapeName] ?? null } }
  })
}

function MapMotion({ country, region, district, resetSignal }) {
  const map = useMap()
  useEffect(() => {
    const target = district ?? region ?? country
    if (!target) return
    const bounds = L.geoJSON(target).getBounds()
    if (region || district) map.flyToBounds(bounds, {
      duration: district ? 1.15 : 1.5,
      easeLinearity: 0.1,
      maxZoom: district ? 12 : 9.5,
      paddingTopLeft: district ? [24, 92] : [42, 110],
      paddingBottomRight: district ? [24, 24] : [42, 42],
    })
    else map.fitBounds(bounds, { animate: Boolean(resetSignal), padding: [54, 54] })
  }, [country, district, map, region, resetSignal])
  return null
}

function Icon({ name }) {
  const path = {
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    reset: <path d="M4.9 7.5A8 8 0 1 1 4 15m.9-7.5H2m2.9 0V4.6"/>,
    expand: <path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>,
    layers: <><path d="m12 2-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    arrow: <path d="m9 18 6-6-6-6"/>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{path[name]}</svg>
}

function MapTexture() {
  return <div className="map-texture" aria-hidden="true">
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none">
      <g className="terrain-lines">
        <path d="M-40 160C180 80 300 250 510 168S820 80 1010 180s340 80 630-34" />
        <path d="M-60 245c190-95 370 80 560 15s350-150 555-30 380 82 600-15" />
        <path d="M-30 690c200-120 360 75 590-60s370-20 540 55 330-35 560-80" />
        <path d="M160 930c-15-220 170-290 110-490S370 90 540-30" />
        <path d="M1050 950c-100-180 90-320 10-490S1110 100 1330-30" />
      </g>
      <g className="road-lines">
        <path d="M-20 470C240 380 390 520 620 390s420-10 570-80 260-30 440 40" />
        <path d="M120 0c40 170 230 230 220 410s210 260 190 520" />
        <path d="M1480-20c-190 180-160 350-310 450S940 680 870 930" />
      </g>
      <g className="water-lines"><path d="M-20 550c280-80 400 115 640 15s470-40 620 20 260 35 390-15" /></g>
    </svg>
  </div>
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [regions, setRegions] = useState(null)
  const [districts, setDistricts] = useState(null)
  const [neighbors, setNeighbors] = useState(null)
  const [regionISO, setRegionISO] = useState(null)
  const [districtID, setDistrictID] = useState(null)
  const [regionMenu, setRegionMenu] = useState(false)
  const [districtMenu, setDistrictMenu] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [error, setError] = useState('')
  const navRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('uzmap-theme', theme)
  }, [theme])

  useEffect(() => {
    const closeMenus = (event) => {
      if (!navRef.current?.contains(event.target)) { setRegionMenu(false); setDistrictMenu(false) }
    }
    document.addEventListener('pointerdown', closeMenus)
    return () => document.removeEventListener('pointerdown', closeMenus)
  }, [])

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
  const mask = useMemo(() => regions ? makeOutsideMask(regions.features) : null, [regions])
  const focusMask = useMemo(() => {
    const target = district ?? region
    return target ? makeOutsideMask([target]) : null
  }, [district, region])
  const orderedRegions = useMemo(() => regions ? [...regions.features].sort((a, b) => regionName(a).localeCompare(regionName(b), 'uz')) : [], [regions])
  const orderedDistricts = useMemo(() => districtSet ? [...districtSet.features].sort((a, b) => a.properties.shapeName.localeCompare(b.properties.shapeName)) : [], [districtSet])

  const chooseRegion = (iso) => { setDistrictID(null); setRegionISO(iso); setRegionMenu(false); setDistrictMenu(false) }
  const chooseDistrict = (id) => { setDistrictID(id); setDistrictMenu(false) }
  const reset = () => { setDistrictID(null); setRegionISO(null); setResetSignal((value) => value + 1); setRegionMenu(false); setDistrictMenu(false) }
  const toggleFullscreen = async () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  const regionStyle = (feature) => {
    const active = feature.properties.shapeISO === regionISO
    const muted = Boolean(regionISO && !active)
    return {
      color: active ? '#238cff' : (theme === 'dark' ? '#31658d' : '#315d7e'), weight: active ? 3.4 : 1.45,
      opacity: muted ? .13 : active ? 1 : .64, fillColor: active ? '#105f34' : '#315747',
      fillOpacity: muted ? .035 : active ? (districtID ? .06 : .2) : .2,
      className: `region-shape${active ? ' region-selected' : ''}${muted ? ' region-muted' : ''}${active && districtID ? ' region-under-focus' : ''}`,
    }
  }
  const districtStyle = (feature) => {
    const active = feature.properties.shapeID === districtID
    const muted = Boolean(districtID && !active)
    return {
      color: active ? '#76b7ff' : '#2485f5', weight: active ? 3.8 : 2.15,
      opacity: muted ? .34 : 1,
      fillColor: active ? '#30ed72' : (districtID ? '#102d3b' : featureColor(feature)),
      fillOpacity: muted ? .28 : active ? .92 : .72,
      className: `district-shape${active ? ' district-selected' : ''}${muted ? ' district-muted' : ''}`,
    }
  }

  return <main className="app-shell">
    <div className="map-shell">
      <MapTexture />
      {error ? <div className="status-card error"><strong>Xarita ochilmadi</strong><span>{error}</span></div> : !regions || !districts || !neighbors ? <div className="status-card"><span className="loader"/><strong>Lokal xarita yuklanmoqda…</strong></div> : <>
        <MapContainer center={[41.25, 64.6]} zoom={5} minZoom={4} maxZoom={12} maxBounds={MAP_BOUNDS} maxBoundsViscosity={.72} zoomControl={false} attributionControl={false} zoomSnap={.25} className="map">
          <ZoomControl position="topright" />
          <MapMotion country={regions} region={region} district={district} resetSignal={resetSignal} />
          <GeoJSON key={`mask-${theme}`} data={mask} interactive={false} style={{ color: 'transparent', fillColor: theme === 'dark' ? '#070b0f' : '#aeb6b4', fillOpacity: theme === 'dark' ? .72 : .72, fillRule: 'evenodd', className: 'outside-mask' }} />
          <GeoJSON key={`neighbors-${theme}`} data={neighbors} interactive={false} style={{ color: theme === 'dark' ? '#456171' : '#536d76', weight: 1.1, opacity: .35, fillColor: theme === 'dark' ? '#252b2c' : '#aab3b0', fillOpacity: .22, className: 'neighbor-country' }} onEachFeature={(feature, layer) => layer.bindTooltip(COUNTRY_NAMES[feature.properties.countryCode] ?? feature.properties.shapeName, { permanent: true, direction: 'center', className: 'country-label' })} />
          {focusMask && <GeoJSON key={`focus-${regionISO}-${districtID}`} data={focusMask} interactive={false} style={{ color: 'transparent', fillColor: '#03070b', fillOpacity: district ? .76 : .62, fillRule: 'evenodd', className: 'focus-mask' }} />}
          <GeoJSON key={`regions-${theme}-${regionISO}-${districtID}`} data={regions} style={regionStyle} onEachFeature={(feature, layer) => {
            layer.bindTooltip(regionName(feature), { permanent: !regionISO, direction: 'center', className: 'region-label' })
            if (feature.properties.shapeISO === regionISO) layer.on('add', () => layer.bringToFront())
            layer.on('click', () => chooseRegion(feature.properties.shapeISO))
          }} />
          {districtSet && <GeoJSON key={`districts-${regionISO}-${districtID}`} data={districtSet} style={districtStyle} onEachFeature={(feature, layer) => {
            layer.bindTooltip(feature.properties.shapeName, { permanent: !districtID, direction: 'center', className: 'district-label' })
            if (feature.properties.shapeID === districtID) layer.on('add', () => layer.bringToFront())
            layer.on('click', () => chooseDistrict(feature.properties.shapeID))
          }} />}
        </MapContainer>

        <header className="floating-navbar" ref={navRef}>
          <button className="nav-brand" onClick={reset} aria-label="O‘zbekiston xaritasiga qaytish"><span><Icon name="layers"/></span><strong>UZMAP</strong></button>
          <div className="nav-select region-select">
            <button className={regionMenu ? 'open' : ''} onClick={() => { setRegionMenu(!regionMenu); setDistrictMenu(false) }}>
              <span>{region ? regionName(region) : 'Viloyatni tanlang'}</span><Icon name="chevron"/>
            </button>
            {regionMenu && <div className="select-menu">{orderedRegions.map((item) => <button className={item.properties.shapeISO === regionISO ? 'active' : ''} key={item.properties.shapeISO} onClick={() => chooseRegion(item.properties.shapeISO)}><span>{regionName(item)}</span><Icon name="arrow"/></button>)}</div>}
          </div>

          {region && <div className="nav-select district-select">
            <button className={districtMenu ? 'open' : ''} onClick={() => { setDistrictMenu(!districtMenu); setRegionMenu(false) }}>
              <span>{district?.properties.shapeName ?? 'Tumanni tanlang'}</span><Icon name="chevron"/>
            </button>
            {districtMenu && <div className="select-menu district-menu">{orderedDistricts.map((item) => <button className={item.properties.shapeID === districtID ? 'active' : ''} key={item.properties.shapeID} onClick={() => chooseDistrict(item.properties.shapeID)}><span>{item.properties.shapeName}</span><Icon name="arrow"/></button>)}</div>}
          </div>}

          <button className="language-button">O‘zbekcha <Icon name="chevron"/></button>
        </header>

        <div className="map-actions">
          <button onClick={reset} title="O‘zbekistonni ko‘rsatish"><Icon name="pin"/></button>
          <button onClick={() => setResetSignal((value) => value + 1)} title="Xaritani qayta markazlash"><Icon name="reset"/></button>
          <button onClick={toggleFullscreen} title="To‘liq ekran"><Icon name="expand"/></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Rang rejimi"><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
        </div>

        <div className="map-status"><i/><span>{district?.properties.shapeName ?? (region ? regionName(region) : 'O‘zbekiston')}</span><small>OFFLINE XARITA</small></div>
      </>}
    </div>
  </main>
}

export default App
