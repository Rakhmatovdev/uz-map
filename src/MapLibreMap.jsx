import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { FileSource, PMTiles, Protocol } from 'pmtiles'
import { createMapStyle } from './mapStyle'

const protocol = new Protocol({ metadata: true })
let protocolRegistered = false

function registerProtocol() {
  if (protocolRegistered) return
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocolRegistered = true
}

function boundsOf(feature) {
  const points = []
  const visit = (value) => {
    if (Array.isArray(value) && value.length >= 2 && value.slice(0, 2).every(Number.isFinite)) points.push(value)
    else if (Array.isArray(value)) value.forEach(visit)
  }
  visit(feature.geometry.coordinates)
  return points.reduce(
    (bounds, [longitude, latitude]) => bounds.extend([longitude, latitude]),
    new maplibregl.LngLatBounds(points[0], points[0]),
  )
}

function focusPadding(map, districtSelected) {
  const { clientWidth: width, clientHeight: height } = map.getContainer()
  if (width <= 760) return {
    top: 126,
    right: 20,
    bottom: districtSelected ? Math.min(240, Math.max(130, height * .28)) : 38,
    left: 20,
  }
  return {
    top: 96,
    right: 42,
    bottom: 46,
    left: districtSelected ? Math.min(330, width * .24) : 42,
  }
}

function outsideMask(features) {
  const holes = []
  const interiorRings = []
  features.forEach(({ geometry }) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    polygons.forEach((polygon) => {
      holes.push(polygon[0])
      polygon.slice(1).forEach((ring) => interiorRings.push(ring))
    })
  })
  const inverse = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [
    [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes,
  ] } }
  if (features.length !== 1 || !interiorRings.length) return inverse
  return {
    type: 'FeatureCollection',
    features: [inverse, ...interiorRings.map((ring) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...ring].reverse()] },
    }))],
  }
}

function prepareRegions(regions, names) {
  return {
    ...regions,
    features: regions.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, iso: feature.properties.shapeISO, displayName: names[feature.properties.shapeISO] ?? feature.properties.shapeName },
    })),
  }
}

function prepareDistricts(districts) {
  if (!districts) return { type: 'FeatureCollection', features: [] }
  return {
    ...districts,
    features: districts.features.map((feature, index) => ({
      ...feature,
      properties: { ...feature.properties, districtID: feature.properties.shapeID, displayName: feature.properties.shapeName, colorIndex: index % 5 },
    })),
  }
}

function addOverlayLayers(map, data, dark) {
  map.addSource('neighbors', { type: 'geojson', data: data.neighbors })
  map.addSource('country-mask', { type: 'geojson', data: outsideMask(data.regions.features) })
  map.addSource('focus-mask', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('regions', { type: 'geojson', data: data.preparedRegions })
  map.addSource('districts', { type: 'geojson', data: data.preparedDistricts })

  // The PMTiles archive uses square vector tiles, so border tiles can contain
  // short road fragments from neighbouring countries. An opaque country mask
  // removes those fragments while the lightweight GeoJSON silhouettes below
  // keep neighbouring countries subtly visible.
  map.addLayer({ id: 'country-mask-fill', type: 'fill', source: 'country-mask', paint: { 'fill-color': dark ? '#080d10' : '#aeb7b3', 'fill-opacity': 1 } })
  map.addLayer({ id: 'neighbors-fill', type: 'fill', source: 'neighbors', paint: { 'fill-color': dark ? '#263034' : '#99a5a0', 'fill-opacity': .2 } })
  map.addLayer({ id: 'neighbors-line', type: 'line', source: 'neighbors', paint: { 'line-color': dark ? '#3b5260' : '#667b83', 'line-width': 1, 'line-opacity': .38 } })
  map.addLayer({ id: 'region-fill', type: 'fill', source: 'regions', paint: { 'fill-color': dark ? '#294638' : '#7ba28d', 'fill-opacity': .13 } })
  map.addLayer({ id: 'region-line', type: 'line', source: 'regions', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#3c6e91' : '#315f7d', 'line-width': 1.2, 'line-opacity': .68 } })
  map.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: { 'fill-color': '#3d7753', 'fill-opacity': .5 } })
  map.addLayer({ id: 'district-line', type: 'line', source: 'districts', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3f78a2', 'line-width': 1.35, 'line-opacity': .82 } })
  map.addLayer({
    id: 'region-label', type: 'symbol', source: 'regions', minzoom: 4,
    layout: { 'text-field': ['get', 'displayName'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-allow-overlap': false },
    paint: { 'text-color': dark ? '#cad7d4' : '#263f42', 'text-halo-color': dark ? '#101719' : '#edf2ed', 'text-halo-width': 1.2 },
  })
  map.addLayer({
    id: 'district-label', type: 'symbol', source: 'districts', minzoom: 5.35,
    layout: { 'text-field': ['get', 'displayName'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 8, 12, 11], 'text-max-width': 7, 'text-allow-overlap': false },
    paint: { 'text-color': dark ? '#d6e0db' : '#263e34', 'text-halo-color': dark ? '#122019' : '#e8efe8', 'text-halo-width': 1.1 },
  })
  map.addLayer({
    id: 'selected-district-glow', type: 'line', source: 'districts', filter: ['==', ['get', 'districtID'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': dark ? '#56b6f5' : '#1777ad', 'line-width': 8, 'line-blur': 4, 'line-opacity': 0 },
  })
  map.addLayer({
    id: 'selected-district-outline', type: 'line', source: 'districts', filter: ['==', ['get', 'districtID'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': dark ? '#8bd2ff' : '#0d5f91', 'line-width': 3, 'line-opacity': 0 },
  })
  // The selected region is dissolved from these same district polygons.
  // Keeping the district highlight below the mask clips its glow exactly at
  // the parent edge, then the region layers restore one crisp outer outline.
  map.addLayer({ id: 'focus-mask-fill', type: 'fill', source: 'focus-mask', paint: { 'fill-color': dark ? '#080d10' : '#aeb7b3', 'fill-opacity': 0 } })
  map.addLayer({ id: 'selected-region-glow', type: 'line', source: 'regions', filter: ['==', ['get', 'iso'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#3f9fdf' : '#1f6f9e', 'line-width': 7, 'line-blur': 3, 'line-opacity': 0 } })
  map.addLayer({ id: 'selected-region-outline', type: 'line', source: 'regions', filter: ['==', ['get', 'iso'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#69b5e6' : '#1d638d', 'line-width': 2, 'line-opacity': 0 } })
}

function syncSelection(map, props) {
  if (!map.isStyleLoaded() || !map.getSource('regions')) return
  const preparedDistricts = prepareDistricts(props.districts)
  map.getSource('districts').setData(preparedDistricts)
  const selectedRegion = props.regions.features.find((feature) => feature.properties.shapeISO === props.regionISO)
  map.getSource('focus-mask').setData(selectedRegion ? outsideMask([selectedRegion]) : { type: 'FeatureCollection', features: [] })

  const regionSelected = Boolean(props.regionISO)
  const districtSelected = Boolean(props.districtID)
  map.setPaintProperty('focus-mask-fill', 'fill-opacity', 0)
  map.setPaintProperty('region-fill', 'fill-opacity', [
    'case',
    ['==', ['get', 'iso'], props.regionISO ?? ''], districtSelected ? .04 : .12,
    regionSelected ? .018 : .13,
  ])
  map.setPaintProperty('region-line', 'line-color', props.theme === 'dark' ? '#345b76' : '#315f7d')
  map.setPaintProperty('region-line', 'line-width', 1.05)
  map.setPaintProperty('region-line', 'line-opacity', regionSelected ? 0 : .62)
  map.setFilter('selected-region-outline', ['==', ['get', 'iso'], props.regionISO ?? ''])
  map.setPaintProperty('selected-region-outline', 'line-opacity', regionSelected ? (districtSelected ? .82 : .96) : 0)
  map.setFilter('selected-region-glow', ['==', ['get', 'iso'], props.regionISO ?? ''])
  map.setPaintProperty('selected-region-glow', 'line-opacity', regionSelected ? (districtSelected ? .13 : .22) : 0)
  map.setFilter('selected-district-outline', ['==', ['get', 'districtID'], props.districtID ?? ''])
  map.setPaintProperty('selected-district-outline', 'line-opacity', districtSelected ? .98 : 0)
  map.setFilter('selected-district-glow', ['==', ['get', 'districtID'], props.districtID ?? ''])
  map.setPaintProperty('selected-district-glow', 'line-opacity', districtSelected ? .32 : 0)
  map.setLayoutProperty('region-label', 'visibility', regionSelected ? 'none' : 'visible')
  map.setPaintProperty('district-fill', 'fill-color', [
    'case',
    ['==', ['get', 'districtID'], props.districtID ?? ''], props.theme === 'dark' ? '#4f9a68' : '#4f9b70',
    ['match', ['get', 'colorIndex'], 0, '#355f45', 1, '#3b6b4c', 2, '#315a42', 3, '#426f52', '#396449'],
  ])
  map.setPaintProperty('district-fill', 'fill-opacity', [
    'case',
    ['==', ['get', 'districtID'], props.districtID ?? ''], .76,
    districtSelected ? .38 : .5,
  ])
  map.setPaintProperty('district-line', 'line-color', ['case', ['==', ['get', 'districtID'], props.districtID ?? ''], props.theme === 'dark' ? '#8bd2ff' : '#0d5f91', '#3d7097'])
  map.setPaintProperty('district-line', 'line-width', ['case', ['==', ['get', 'districtID'], props.districtID ?? ''], 2.4, 1.3])
  map.setPaintProperty('district-line', 'line-opacity', ['case', ['==', ['get', 'districtID'], props.districtID ?? ''], .98, districtSelected ? .68 : .8])
  map.setLayoutProperty('district-label', 'visibility', 'visible')
  map.setLayoutProperty('district-label', 'text-size', [
    'interpolate', ['linear'], ['zoom'],
    5.35, ['case', ['==', ['get', 'districtID'], props.districtID ?? ''], 9.5, 7.5],
    12, ['case', ['==', ['get', 'districtID'], props.districtID ?? ''], 13, 11],
  ])
  map.setPaintProperty('district-label', 'text-color', [
    'case', ['==', ['get', 'districtID'], props.districtID ?? ''], props.theme === 'dark' ? '#f3fbff' : '#0e3241',
    props.theme === 'dark' ? '#d6e0db' : '#263e34',
  ])
  map.setPaintProperty('district-label', 'text-halo-color', [
    'case', ['==', ['get', 'districtID'], props.districtID ?? ''], props.theme === 'dark' ? '#174867' : '#d8eef4',
    props.theme === 'dark' ? '#122019' : '#e8efe8',
  ])
  map.setPaintProperty('district-label', 'text-opacity', districtSelected ? [
    'case', ['==', ['get', 'districtID'], props.districtID ?? ''], 1, .82,
  ] : 1)

  const selectedDistrict = districtSelected && preparedDistricts.features.find((feature) => feature.properties.districtID === props.districtID)
  if (selectedDistrict) {
    map.fitBounds(boundsOf(selectedDistrict), { padding: focusPadding(map, true), duration: 760, maxZoom: 12 })
  } else if (selectedRegion) {
    map.fitBounds(boundsOf(selectedRegion), { padding: focusPadding(map, districtSelected), duration: districtSelected ? 760 : 1250, maxZoom: 10 })
  } else {
    map.fitBounds([[55.9, 37.1], [73.2, 45.6]], { padding: 55, duration: 900 })
  }
}

export default function MapLibreMap(props) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const latestProps = useRef(props)
  latestProps.current = props

  const packageInfo = useMemo(() => {
    registerProtocol()
    if (props.offlineBlob) {
      const file = new File([props.offlineBlob], 'uzbekistan-offline.pmtiles', { type: 'application/vnd.pmtiles' })
      const archive = new PMTiles(new FileSource(file))
      protocol.add(archive)
      return { key: archive.source.getKey(), identity: `offline-${file.size}` }
    }
    if (props.pmtilesUrl) {
      const archive = new PMTiles(props.pmtilesUrl)
      protocol.add(archive)
      return { key: archive.source.getKey(), identity: props.pmtilesUrl }
    }
    return { key: null, identity: 'no-basemap' }
  }, [props.offlineBlob, props.pmtilesUrl])

  useEffect(() => {
    if (!containerRef.current) return undefined
    const preparedRegions = prepareRegions(props.regions, props.regionNames)
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createMapStyle(packageInfo.key, props.theme, import.meta.env.BASE_URL),
      center: [64.6, 41.25],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: [[51.4, 35.4], [77.2, 47.9]],
      attributionControl: false,
      renderWorldCopies: false,
      localIdeographFontFamily: 'sans-serif',
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      const current = latestProps.current
      addOverlayLayers(map, {
        neighbors: current.neighbors,
        regions: current.regions,
        preparedRegions,
        preparedDistricts: prepareDistricts(current.districts),
      }, current.theme === 'dark')
      syncSelection(map, current)
    })
    map.on('click', (event) => {
      const current = latestProps.current
      const districtHit = map.queryRenderedFeatures(event.point, { layers: ['district-fill'] })[0]
      if (districtHit?.properties?.districtID) return current.onDistrictSelect(districtHit.properties.districtID)
      const regionHit = map.queryRenderedFeatures(event.point, { layers: ['region-fill'] })[0]
      if (regionHit?.properties?.iso) current.onRegionSelect(regionHit.properties.iso)
    })
    map.on('mousemove', (event) => {
      const hit = map.queryRenderedFeatures(event.point, { layers: ['district-fill', 'region-fill'] })[0]
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
    })
    return () => { map.remove(); mapRef.current = null }
  }, [packageInfo.identity, packageInfo.key, props.neighbors, props.regionNames, props.regions, props.theme])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.loaded()) syncSelection(map, latestProps.current)
  }, [props.districtID, props.districts, props.regionISO])

  return <div ref={containerRef} className="maplibre-map" />
}
