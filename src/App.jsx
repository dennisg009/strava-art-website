import { useState, useCallback, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, ImageOverlay, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in React
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: onMapClick,
  })
  return null
}

function MapController({ mapRef, onMapReady }) {
  const map = useMap()
  useEffect(() => {
    if (mapRef) {
      mapRef.current = map
    }
    if (onMapReady) {
      onMapReady()
    }
  }, [map, mapRef, onMapReady])
  return null
}

function ChangeView({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom())
    }
  }, [center, zoom, map])
  return null
}

function App() {
  const [points, setPoints] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [imageOverlay, setImageOverlay] = useState(null)
  const [imageOpacity, setImageOpacity] = useState(0.5)
  const [imageBounds, setImageBounds] = useState(null)
  const [snapToRoads, setSnapToRoads] = useState(false)
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060])
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef(null)

  // Handle map click to add points
  const handleMapClick = useCallback(async (e) => {
    const newPoint = [e.latlng.lat, e.latlng.lng]
    
    if (snapToRoads && points.length > 0) {
      // If snapping to roads and we have a previous point, get route
      const lastPoint = points[points.length - 1]
      try {
        const route = await getOSRMRoute([lastPoint[0], lastPoint[1]], [newPoint[0], newPoint[1]])
        if (route && route.length > 1) {
          // Add route points excluding the first one (since it's the same as the last point)
          setPoints(prev => [...prev, ...route.slice(1)])
          return
        }
      } catch (error) {
        console.error('OSRM route error:', error)
      }
    }
    
    setPoints(prev => [...prev, newPoint])
  }, [points, snapToRoads])

  // Get OSRM route between two points
  const getOSRMRoute = async (start, end) => {
    const url = `http://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
    
    try {
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates
        // Convert from [lng, lat] to [lat, lng] format
        return coordinates.map(coord => [coord[1], coord[0]])
      }
    } catch (error) {
      console.error('OSRM API error:', error)
    }
    
    // Fallback to straight line if OSRM fails
    return [[start[0], start[1]], [end[0], end[1]]]
  }

  // Search location using Nominatim
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      )
      const data = await response.json()

      if (data.length > 0) {
        const result = data[0]
        const lat = parseFloat(result.lat)
        const lon = parseFloat(result.lon)
        
        setMapCenter([lat, lon])
        setSearchQuery('')
      } else {
        alert('Location not found')
      }
    } catch (error) {
      console.error('Search error:', error)
      alert('Error searching location')
    }
  }

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setImageOverlay(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Set image bounds when image is uploaded (use current map center as bounds)
  useEffect(() => {
    if (imageOverlay && mapRef.current) {
      // Small delay to ensure map is fully initialized
      const timer = setTimeout(() => {
        if (mapRef.current) {
          const bounds = mapRef.current.getBounds()
          const imageBoundsArray = [
            [bounds.getSouth(), bounds.getWest()],
            [bounds.getNorth(), bounds.getEast()]
          ]
          setImageBounds(imageBoundsArray)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [imageOverlay])

  // Delete last point
  const deleteLastPoint = () => {
    setPoints(prev => prev.slice(0, -1))
  }

  // Clear all points
  const clearAll = () => {
    setPoints([])
  }

  // Export GPX
  const exportGPX = () => {
    if (points.length === 0) {
      alert('No points to export')
      return
    }

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava Art Creator">
  <trk>
    <name>Strava Art Route</name>
    <trkseg>
`

    points.forEach(coord => {
      gpx += `      <trkpt lat="${coord[0]}" lon="${coord[1]}"></trkpt>\n`
    })

    gpx += `    </trkseg>
  </trk>
</gpx>`

    // Download file
    const blob = new Blob([gpx], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'strava-art-route.gpx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Add useEffect to log when component mounts
  useEffect(() => {
    console.log('App component mounted')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="text-center text-white mb-6 bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl">
          <h1 className="text-4xl font-bold mb-2">🎨 Strava Art Creator</h1>
          <p className="text-lg opacity-90">Create beautiful GPS art for your Strava activities</p>
        </header>

        {/* Controls Panel */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search Bar */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">Search Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter location..."
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  🔍
                </button>
              </div>
            </div>

            {/* Image Upload */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">Upload Image Overlay</label>
              <input
                type="file"
                accept="image/png,image/*"
                onChange={handleImageUpload}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
              {imageOverlay && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Opacity:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={imageOpacity}
                    onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 w-12">{Math.round(imageOpacity * 100)}%</span>
                  <button
                    onClick={() => {
                      setImageOverlay(null)
                      setImageBounds(null)
                    }}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Snap to Roads Toggle */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">Route Options</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapToRoads}
                  onChange={(e) => setSnapToRoads(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-gray-700">Snap to Roads (OSRM)</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">Actions</label>
              <div className="flex gap-2">
                <button
                  onClick={deleteLastPoint}
                  disabled={points.length === 0}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Last Point
                </button>
                <button
                  onClick={clearAll}
                  disabled={points.length === 0}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">Export</label>
              <button
                onClick={exportGPX}
                disabled={points.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export GPX
              </button>
            </div>

            {/* Points Counter */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">Route Info</label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg">
                <p className="text-gray-700">
                  Points: <span className="font-bold">{points.length}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden" style={{ minHeight: '600px' }}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '600px', width: '100%' }}
          >
            <MapController mapRef={mapRef} onMapReady={() => setMapReady(true)} />
            <ChangeView center={mapCenter} zoom={13} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Image Overlay */}
            {imageOverlay && imageBounds && (
              <ImageOverlay
                url={imageOverlay}
                bounds={imageBounds}
                opacity={imageOpacity}
              />
            )}

            {/* Markers */}
            {points.map((point, index) => (
              <Marker key={index} position={point} />
            ))}

            {/* Polyline */}
            {points.length > 1 && (
              <Polyline
                positions={points}
                color="#667eea"
                weight={4}
                opacity={0.8}
              />
            )}

            {/* Map Click Handler */}
            <MapClickHandler onMapClick={handleMapClick} />
          </MapContainer>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl p-6 mt-6 shadow-xl">
          <h3 className="text-xl font-bold text-indigo-600 mb-4">Instructions</h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Click on the map to add points and create your route</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Use the search bar to quickly navigate to any location</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Upload a transparent PNG image to overlay and trace over</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Enable "Snap to Roads" to automatically route along streets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Export your route as GPX for use in Strava</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App

