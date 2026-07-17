import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import area from '@turf/area'
import { union } from '@turf/union'
import { deleteOfflinePackage, readOfflinePackage, saveOfflinePackage } from './offlineStore'
import './App.css'

const MapLibreMap = lazy(() => import('./MapLibreMap'))

const REGION_NAMES = {
  'UZ-AN': 'Andijon viloyati', 'UZ-BU': 'Buxoro viloyati',
  'UZ-FA': 'Farg‘ona viloyati', 'UZ-JI': 'Jizzax viloyati',
  'UZ-NG': 'Namangan viloyati', 'UZ-NW': 'Navoiy viloyati',
  'UZ-QA': 'Qashqadaryo viloyati', 'UZ-QR': 'Qoraqalpog‘iston Respublikasi',
  'UZ-SA': 'Samarqand viloyati', 'UZ-SI': 'Sirdaryo viloyati',
  'UZ-SU': 'Surxondaryo viloyati', 'UZ-TK': 'Toshkent shahri',
  'UZ-TO': 'Toshkent viloyati', 'UZ-XO': 'Xorazm viloyati',
}
const DISTRICT_PARENT_FALLBACK = { Khazarasp: 'UZ-XO', Sokh: 'UZ-FA', 'Shirin city': 'UZ-SI' }
const regionName = (feature) => REGION_NAMES[feature?.properties.shapeISO] ?? feature?.properties.shapeName ?? ''

function initialTheme() {
  const saved = localStorage.getItem('uzmap-theme')
  return saved === 'light' || saved === 'dark' ? saved : 'dark'
}

function attachParents(districts, regions) {
  return districts.map((district) => {
    const parent = regions.find((region) => booleanPointInPolygon(pointOnFeature(district), region))
    return { ...district, properties: { ...district.properties, parentISO: parent?.properties.shapeISO ?? DISTRICT_PARENT_FALLBACK[district.properties.shapeName] ?? null } }
  })
}

function deriveRegionsFromDistricts(districts, sourceRegions) {
  const districtsByRegion = new Map()
  districts.features.forEach((district) => {
    const iso = district.properties.parentISO
    if (!iso) return
    const group = districtsByRegion.get(iso) ?? []
    group.push(district)
    districtsByRegion.set(iso, group)
  })

  return {
    ...sourceRegions,
    features: sourceRegions.features.map((region) => {
      const children = districtsByRegion.get(region.properties.shapeISO)
      if (!children?.length) return region
      try {
        return union(
          { type: 'FeatureCollection', features: children },
          { properties: { ...region.properties } },
        ) ?? region
      } catch {
        return region
      }
    }),
  }
}

function formatSize(bytes) {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`
}

function Icon({ name }) {
  const path = {
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    expand: <path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>,
    layers: <><path d="m12 2-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 21h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{path[name]}</svg>
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [regions, setRegions] = useState(null)
  const [districts, setDistricts] = useState(null)
  const [neighbors, setNeighbors] = useState(null)
  const [pmtilesUrl, setPmtilesUrl] = useState(null)
  const [packageBytes, setPackageBytes] = useState(0)
  const [mapMode, setMapMode] = useState('boundary')
  const [offlineBlob, setOfflineBlob] = useState(null)
  const [offlineState, setOfflineState] = useState('checking')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadedBytes, setDownloadedBytes] = useState(0)
  const [regionISO, setRegionISO] = useState(null)
  const [districtID, setDistrictID] = useState(null)
  const [regionMenu, setRegionMenu] = useState(false)
  const [districtMenu, setDistrictMenu] = useState(false)
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
      fetch(`${base}data/uzbekistan-adm1.geojson`).then((response) => response.ok ? response.json() : Promise.reject(new Error('Viloyatlar fayli topilmadi'))),
      fetch(`${base}data/uzbekistan-adm2.geojson`).then((response) => response.ok ? response.json() : Promise.reject(new Error('Tumanlar fayli topilmadi'))),
      fetch(`${base}data/neighboring-countries.geojson`).then((response) => response.ok ? response.json() : Promise.reject(new Error('Qo‘shni davlatlar fayli topilmadi'))),
      fetch(`${base}data/map-config.json`).then((response) => response.ok ? response.json() : { pmtilesUrl: null, bytes: 0 }),
      readOfflinePackage().catch(() => null),
    ]).then(([adm1, adm2, nearby, config, storedPackage]) => {
      const attachedDistricts = { ...adm2, features: attachParents(adm2.features, adm1.features) }
      setRegions(deriveRegionsFromDistricts(attachedDistricts, adm1))
      setDistricts(attachedDistricts)
      setNeighbors(nearby)
      setPmtilesUrl(config.pmtilesUrl || null)
      setPackageBytes(config.bytes || 0)
      setMapMode(config.mode || 'remote')
      setOfflineBlob(storedPackage)
      setOfflineState(config.mode === 'local' ? 'local' : storedPackage ? 'saved' : config.pmtilesUrl ? 'available' : 'preparing')
    }).catch((reason) => setError(reason.message))
  }, [])

  const region = useMemo(() => regions?.features.find((feature) => feature.properties.shapeISO === regionISO) ?? null, [regionISO, regions])
  const districtSet = useMemo(() => districts && regionISO ? { ...districts, features: districts.features.filter((feature) => feature.properties.parentISO === regionISO) } : null, [districts, regionISO])
  const district = useMemo(() => districtSet?.features.find((feature) => feature.properties.shapeID === districtID) ?? null, [districtID, districtSet])
  const orderedRegions = useMemo(() => regions ? [...regions.features].sort((a, b) => regionName(a).localeCompare(regionName(b), 'uz')) : [], [regions])
  const orderedDistricts = useMemo(() => districtSet ? [...districtSet.features].sort((a, b) => a.properties.shapeName.localeCompare(b.properties.shapeName)) : [], [districtSet])
  const districtInfo = useMemo(() => {
    if (!district || !region) return null
    const [longitude, latitude] = pointOnFeature(district).geometry.coordinates
    const name = district.properties.shapeName
    return {
      name,
      region: regionName(region),
      type: /city|shahar/i.test(name) ? 'Shahar' : 'Tuman',
      area: area(district) / 1_000_000,
      latitude,
      longitude,
      id: district.properties.shapeID,
    }
  }, [district, region])

  const chooseRegion = (iso) => { setDistrictID(null); setRegionISO(iso); setRegionMenu(false); setDistrictMenu(false) }
  const chooseDistrict = (id) => { setDistrictID(id); setDistrictMenu(false) }
  const reset = () => { setDistrictID(null); setRegionISO(null); setRegionMenu(false); setDistrictMenu(false) }
  const toggleFullscreen = async () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  const saveForOffline = async () => {
    if (!pmtilesUrl || offlineState === 'downloading') return
    setOfflineState('downloading')
    setDownloadProgress(0)
    setDownloadedBytes(0)
    try {
      const blob = await saveOfflinePackage(pmtilesUrl, (percent, received) => {
        setDownloadProgress(percent)
        setDownloadedBytes(received)
      })
      setOfflineBlob(blob)
      setOfflineState('saved')
    } catch (reason) {
      setOfflineState('error')
      setError(reason.message)
    }
  }

  const removeOffline = async () => {
    await deleteOfflinePackage()
    setOfflineBlob(null)
    setOfflineState(mapMode === 'local' ? 'local' : pmtilesUrl ? 'available' : 'preparing')
  }

  const loading = !regions || !districts || !neighbors || offlineState === 'checking'

  return <main className="app-shell">
    <div className="map-shell">
      {error && <div className="toast-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
      {loading ? <div className="status-card"><span className="loader"/><strong>Xarita yuklanmoqda…</strong></div> : <>
        <Suspense fallback={<div className="status-card"><span className="loader"/><strong>MapLibre yuklanmoqda…</strong></div>}>
          <MapLibreMap
            theme={theme}
            regions={regions}
            districts={districtSet}
            neighbors={neighbors}
            regionISO={regionISO}
            districtID={districtID}
            regionNames={REGION_NAMES}
            pmtilesUrl={pmtilesUrl}
            offlineBlob={offlineBlob}
            onRegionSelect={chooseRegion}
            onDistrictSelect={chooseDistrict}
          />
        </Suspense>

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

        {offlineState !== 'local' && <div className="offline-control">
          {offlineState === 'saved' ? <>
            <span className="offline-ready"><Icon name="check"/><span><strong>Ko‘chalar offline</strong><small>{formatSize(offlineBlob?.size)}</small></span></span>
            <button className="offline-delete" onClick={removeOffline} title="Offline paketni o‘chirish"><Icon name="trash"/></button>
          </> : offlineState === 'downloading' ? <div className="download-state"><span><strong>Offline saqlanmoqda</strong><small>{downloadProgress ? `${downloadProgress}%` : formatSize(downloadedBytes)}</small></span><i><b style={{ width: `${downloadProgress}%` }}/></i></div> : <button className="offline-download" onClick={saveForOffline} disabled={offlineState === 'preparing'}>
            <Icon name="download"/><span><strong>{offlineState === 'preparing' ? 'Ko‘cha paketi tayyorlanmoqda' : 'Offline saqlash'}</strong><small>{packageBytes ? formatSize(packageBytes) : 'Chegaralar hozir ham offline'}</small></span>
          </button>}
        </div>}

        <div className="map-actions">
          <button onClick={toggleFullscreen} title="To‘liq ekran"><Icon name="expand"/></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Rang rejimi"><Icon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
        </div>
        {districtInfo ? <section className="district-info" aria-label={`${districtInfo.name} haqida ma’lumot`}>
          <header>
            <span><small>{districtInfo.type}</small><strong>{districtInfo.name}</strong></span>
            <button onClick={() => setDistrictID(null)} aria-label="Tuman ma’lumotini yopish">×</button>
          </header>
          <p>{districtInfo.region}</p>
          <dl>
            <div><dt>Maydoni</dt><dd>{districtInfo.area.toLocaleString('uz-UZ', { maximumFractionDigits: 1 })} km²</dd></div>
            <div><dt>Markaz nuqtasi</dt><dd>{districtInfo.latitude.toFixed(4)}°, {districtInfo.longitude.toFixed(4)}°</dd></div>
            <div><dt>Ma’lumot turi</dt><dd>ADM2 chegara</dd></div>
          </dl>
          <footer><i/><span>Geometriyadan lokal hisoblandi</span><code>{districtInfo.id.slice(-8)}</code></footer>
        </section> : <div className="map-status"><i/><span>{region ? regionName(region) : 'O‘zbekiston'}</span><small>{offlineBlob || mapMode === 'local' ? 'OFFLINE KO‘CHALAR' : 'OFFLINE CHEGARALAR'}</small></div>}
      </>}
    </div>
  </main>
}

export default App
