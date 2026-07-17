const roadWidth = [
  'interpolate', ['linear'], ['zoom'],
  5, .3,
  10, 1,
  14, 3.4,
  17, 10,
]

const roadCasingWidth = [
  'interpolate', ['linear'], ['zoom'],
  5, 1.6,
  10, 2.3,
  14, 4.7,
  17, 11.3,
]

const roadColor = [
  'match', ['get', 'kind'],
  ['motorway', 'trunk'], '#b47a22',
  ['primary', 'secondary'], '#8d692d',
  ['rail'], '#65717b',
  '#53606a',
]

export function createMapStyle(pmtilesKey, theme, baseUrl) {
  const dark = theme === 'dark'
  const sources = pmtilesKey
    ? { streets: { type: 'vector', url: `pmtiles://${pmtilesKey}` } }
    : {}
  const basemap = pmtilesKey
    ? [
        {
          id: 'land', type: 'fill', source: 'streets', 'source-layer': 'land',
          paint: { 'fill-color': dark ? '#202722' : '#dfe7dd', 'fill-opacity': .84 },
        },
        {
          id: 'sites', type: 'fill', source: 'streets', 'source-layer': 'sites', minzoom: 10,
          paint: { 'fill-color': dark ? '#29312c' : '#d5dfd4', 'fill-opacity': .72 },
        },
        {
          id: 'water-polygons', type: 'fill', source: 'streets', 'source-layer': 'water_polygons',
          paint: { 'fill-color': dark ? '#173a50' : '#87b7ce', 'fill-opacity': .9 },
        },
        {
          id: 'buildings', type: 'fill', source: 'streets', 'source-layer': 'buildings', minzoom: 13,
          paint: {
            'fill-color': dark ? '#3a403d' : '#c7cbc6',
            'fill-outline-color': dark ? '#4a5350' : '#adb4ae',
            'fill-opacity': .88,
          },
        },
        {
          id: 'water-lines', type: 'line', source: 'streets', 'source-layer': 'water_lines', minzoom: 8,
          paint: { 'line-color': dark ? '#2f739a' : '#569ebc', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, .4, 15, 2.5], 'line-opacity': .85 },
        },
        {
          id: 'street-casing', type: 'line', source: 'streets', 'source-layer': 'streets', minzoom: 6,
          paint: { 'line-color': dark ? '#121719' : '#aab0ab', 'line-width': roadCasingWidth, 'line-opacity': .86 },
        },
        {
          id: 'streets', type: 'line', source: 'streets', 'source-layer': 'streets', minzoom: 6,
          paint: { 'line-color': roadColor, 'line-width': roadWidth, 'line-opacity': .88 },
        },
        {
          id: 'boundaries', type: 'line', source: 'streets', 'source-layer': 'boundaries',
          paint: { 'line-color': dark ? '#45637b' : '#6b8291', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': .48 },
        },
        {
          id: 'place-labels', type: 'symbol', source: 'streets', 'source-layer': 'place_labels', minzoom: 5,
          layout: {
            'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 13, 13, 17, 15],
            'text-max-width': 8,
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': dark ? '#b9c1c4' : '#334247',
            'text-halo-color': dark ? '#151b1d' : '#eff3ef',
            'text-halo-width': 1.4,
          },
        },
        {
          id: 'street-labels', type: 'symbol', source: 'streets', 'source-layer': 'street_labels', minzoom: 12,
          layout: {
            'symbol-placement': 'line',
            'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 17, 12],
            'text-keep-upright': true,
          },
          paint: {
            'text-color': dark ? '#9da8ad' : '#4c5b60',
            'text-halo-color': dark ? '#181d1f' : '#eef2ed',
            'text-halo-width': 1.2,
          },
        },
      ]
    : []

  return {
    version: 8,
    glyphs: `${baseUrl}fonts/{fontstack}/{range}.pbf`,
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': dark ? '#111719' : '#ccd3cf' } },
      ...basemap,
    ],
  }
}
