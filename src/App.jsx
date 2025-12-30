import { useState, useCallback, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, ImageOverlay, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Tooltip } from './Tooltip'
import ResizableImageOverlay from './ResizableImageOverlay'

// Fix for default marker icons in React
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [13, 21], // 50% of default (26, 42)
  iconAnchor: [13, 21],
  popupAnchor: [0, -21],
  shadowSize: [20, 20],
  shadowAnchor: [4, 20]
})

function MapClickHandler({ onMapClick, isDrawingMode }) {
  useMapEvents({
    click: (e) => {
      // Don't add points when in drawing mode
      if (!isDrawingMode) {
        onMapClick(e)
      }
    },
  })
  return null
}

// Drawing handler component for freehand drawing
function DrawingHandler({ isDrawingMode, currentLineRef, onLineComplete, setCurrentLine }) {
  const map = useMap()
  const isDrawingRef = useRef(false)
  
  useEffect(() => {
    if (!isDrawingMode || !map) return
    
    const handleMouseDown = (e) => {
      // Prevent default to stop map dragging
      L.DomEvent.stop(e)
      isDrawingRef.current = true
      map.dragging.disable()
      
      // Start new line
      const point = [e.latlng.lat, e.latlng.lng]
      currentLineRef.current = [point]
      setCurrentLine([point])
    }
    
    const handleMouseMove = (e) => {
      if (!isDrawingRef.current) return
      
      const point = [e.latlng.lat, e.latlng.lng]
      currentLineRef.current = [...currentLineRef.current, point]
      setCurrentLine([...currentLineRef.current])
    }
    
    const handleMouseUp = () => {
      if (!isDrawingRef.current) return
      
      isDrawingRef.current = false
      map.dragging.enable()
      
      // Complete the line if it has enough points
      if (currentLineRef.current.length > 1) {
        onLineComplete([...currentLineRef.current])
      }
      
      currentLineRef.current = []
      setCurrentLine([])
    }
    
    // Change cursor to crosshair when in drawing mode
    const container = map.getContainer()
    container.style.cursor = 'crosshair'
    
    map.on('mousedown', handleMouseDown)
    map.on('mousemove', handleMouseMove)
    map.on('mouseup', handleMouseUp)
    // Also handle mouse leaving the map
    map.on('mouseout', handleMouseUp)
    
    return () => {
      container.style.cursor = ''
      map.off('mousedown', handleMouseDown)
      map.off('mousemove', handleMouseMove)
      map.off('mouseup', handleMouseUp)
      map.off('mouseout', handleMouseUp)
      map.dragging.enable()
      isDrawingRef.current = false
    }
  }, [isDrawingMode, map, currentLineRef, onLineComplete, setCurrentLine])
  
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
  const [mapCenter, setMapCenter] = useState([37.7749, -122.4194]) // San Francisco
  const [mapReady, setMapReady] = useState(false)
  const [isRouting, setIsRouting] = useState(false)
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [showMileagePrompt, setShowMileagePrompt] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [referenceOverlay, setReferenceOverlay] = useState(null)
  const [referenceBounds, setReferenceBounds] = useState(null)
  const [referenceOpacity, setReferenceOpacity] = useState(0.5)
  const [referenceAspectRatio, setReferenceAspectRatio] = useState(null)
  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [drawnLines, setDrawnLines] = useState([]) // Array of completed lines
  const [currentLine, setCurrentLine] = useState([]) // Line currently being drawn
  const [undoStack, setUndoStack] = useState([]) // For undo functionality
  const [redoStack, setRedoStack] = useState([]) // For redo functionality
  const currentLineRef = useRef([]) // Ref for tracking current line during draw
  const [isSnappingRoads, setIsSnappingRoads] = useState(false)
  const [routeDistance, setRouteDistance] = useState(null) // Distance in miles
  const mapRef = useRef(null)
  const pngFileInputRef = useRef(null)

  // Calculate route distance whenever points change
  useEffect(() => {
    if (points.length >= 2) {
      let totalDistance = 0
      for (let i = 1; i < points.length; i++) {
        const R = 3959 // Earth's radius in miles
        const lat1 = points[i - 1][0] * Math.PI / 180
        const lat2 = points[i][0] * Math.PI / 180
        const deltaLat = (points[i][0] - points[i - 1][0]) * Math.PI / 180
        const deltaLng = (points[i][1] - points[i - 1][1]) * Math.PI / 180
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        
        totalDistance += R * c
      }
      setRouteDistance(totalDistance)
    } else {
      setRouteDistance(null)
    }
  }, [points])

  // Handle line completion (called when mouse is released after drawing)
  const handleLineComplete = useCallback((line) => {
    if (line && line.length > 1) {
      setDrawnLines(prev => {
        // Save current state to undo stack
        setUndoStack(undoPrev => [...undoPrev, { type: 'add', lines: prev }])
        setRedoStack([]) // Clear redo stack on new action
        return [...prev, line]
      })
    }
  }, [])

  // Delete last drawn line
  const deleteLastLine = useCallback(() => {
    if (drawnLines.length === 0) return
    
    setUndoStack(prev => [...prev, { type: 'delete', lines: drawnLines }])
    setRedoStack([])
    setDrawnLines(prev => prev.slice(0, -1))
  }, [drawnLines])

  // Undo action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    
    const lastAction = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, { type: 'undo', lines: drawnLines }])
    setDrawnLines(lastAction.lines)
    setUndoStack(prev => prev.slice(0, -1))
  }, [undoStack, drawnLines])

  // Redo action
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    
    const lastRedo = redoStack[redoStack.length - 1]
    setUndoStack(prev => [...prev, { type: 'redo', lines: drawnLines }])
    setDrawnLines(lastRedo.lines)
    setRedoStack(prev => prev.slice(0, -1))
  }, [redoStack, drawnLines])

  // Clear all drawings
  const clearAllDrawings = useCallback(() => {
    if (drawnLines.length === 0) return
    
    setUndoStack(prev => [...prev, { type: 'clear', lines: drawnLines }])
    setRedoStack([])
    setDrawnLines([])
  }, [drawnLines])

  // Get OSRM route between two points
  const getOSRMRoute = useCallback(async (start, end) => {
    // Use HTTPS and the public OSRM instance
    // Format: lon,lat (OSRM uses [longitude, latitude] order)
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates
        // Convert from [lng, lat] to [lat, lng] format for Leaflet
        return coordinates.map(coord => [coord[1], coord[0]])
      } else {
        console.warn('OSRM returned error code:', data.code)
      }
    } catch (error) {
      console.error('OSRM API error:', error)
    }
    
    // Fallback to straight line if OSRM fails
    return [[start[0], start[1]], [end[0], end[1]]]
  }, [])

  // Convert normalized points to map coordinates based on current bounds
  const normalizedToMapCoords = useCallback((normalizedPoints, bounds) => {
    if (!bounds || normalizedPoints.length === 0) return []
    
    const south = bounds[0][0]
    const west = bounds[0][1]
    const north = bounds[1][0]
    const east = bounds[1][1]
    const height = north - south
    const width = east - west
    
    return normalizedPoints
      .filter(p => !isNaN(p[0]) && !isNaN(p[1]))
      .map(p => {
        // SVG y increases downward, lat increases upward, so invert y
        const lat = north - p[1] * height
        const lng = west + p[0] * width
        return [lat, lng]
      })
      .filter(p => !isNaN(p[0]) && !isNaN(p[1]))
  }, [])

  // Snap points to roads using OSRM
  const snapToRoadsOSRM = useCallback(async (mapPoints) => {
    if (mapPoints.length < 2) return mapPoints
    
    // Reduce waypoints for OSRM (max ~100 per request)
    const MAX_WAYPOINTS = 40
    let waypoints = mapPoints
    if (mapPoints.length > MAX_WAYPOINTS) {
      const step = Math.ceil(mapPoints.length / MAX_WAYPOINTS)
      waypoints = []
      for (let i = 0; i < mapPoints.length; i += step) {
        waypoints.push(mapPoints[i])
      }
      if (waypoints[waypoints.length - 1] !== mapPoints[mapPoints.length - 1]) {
        waypoints.push(mapPoints[mapPoints.length - 1])
      }
    }
    
    const snappedPoints = []
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      try {
        const segment = await getOSRMRoute(waypoints[i], waypoints[i + 1])
        if (segment && segment.length > 0) {
          if (i === 0) {
            snappedPoints.push(...segment)
          } else {
            snappedPoints.push(...segment.slice(1))
          }
        } else {
          if (i === 0) snappedPoints.push(waypoints[i])
          snappedPoints.push(waypoints[i + 1])
        }
      } catch (err) {
        console.warn('OSRM segment error:', err)
        if (i === 0) snappedPoints.push(waypoints[i])
        snappedPoints.push(waypoints[i + 1])
      }
    }
    
    return snappedPoints
  }, [getOSRMRoute])

  // Convert drawings to route points (with optional road snapping)
  const convertDrawingsToRoute = useCallback(async () => {
    if (drawnLines.length === 0) {
      alert('No drawings to convert')
      return
    }
    
    // Flatten all drawn lines into a single route
    const allPoints = drawnLines.flat()
    
    if (snapToRoads && allPoints.length >= 2) {
      // Snap to roads using OSRM
      setIsSnappingRoads(true)
      try {
        const snappedPoints = await snapToRoadsOSRM(allPoints)
        setPoints(snappedPoints)
        alert(`Converted ${drawnLines.length} line(s) to road-snapped route with ${snappedPoints.length} points`)
      } catch (err) {
        console.error('Road snapping error:', err)
        // Fall back to direct points
        setPoints(allPoints)
        alert(`Road snapping failed. Converted to ${allPoints.length} points without snapping.`)
      } finally {
        setIsSnappingRoads(false)
      }
    } else {
      setPoints(allPoints)
      alert(`Converted ${drawnLines.length} line(s) to route with ${allPoints.length} points`)
    }
  }, [drawnLines, snapToRoads, snapToRoadsOSRM])

  // Handle map click to add points
  const handleMapClick = useCallback(async (e) => {
    const newPoint = [e.latlng.lat, e.latlng.lng]
    
    if (snapToRoads && points.length > 0) {
      // If snapping to roads and we have a previous point, get route
      setIsRouting(true)
      const lastPoint = points[points.length - 1]
      try {
        const route = await getOSRMRoute([lastPoint[0], lastPoint[1]], [newPoint[0], newPoint[1]])
        if (route && route.length > 1) {
          // Add route points excluding the first one (since it's the same as the last point)
          setPoints(prev => [...prev, ...route.slice(1)])
          setIsRouting(false)
          return
        }
      } catch (error) {
        console.error('OSRM route error:', error)
        // Fall through to add the point normally
      } finally {
        setIsRouting(false)
      }
    }
    
    setPoints(prev => [...prev, newPoint])
  }, [points, snapToRoads, getOSRMRoute])

  // Center map on user's current location
  const centerOnMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setMapCenter([latitude, longitude])
      },
      (error) => {
        console.error('Geolocation error:', error)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('Location access denied. Please enable location permissions in your browser settings.')
            break
          case error.POSITION_UNAVAILABLE:
            alert('Location information is unavailable.')
            break
          case error.TIMEOUT:
            alert('Location request timed out.')
            break
          default:
            alert('An unknown error occurred while getting your location.')
            break
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
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

  // Calculate distance between two points in miles using Haversine formula
  const calculateDistance = (point1, point2) => {
    const R = 3959 // Earth's radius in miles
    const lat1 = point1[0] * Math.PI / 180
    const lat2 = point2[0] * Math.PI / 180
    const deltaLat = (point2[0] - point1[0]) * Math.PI / 180
    const deltaLng = (point2[1] - point1[1]) * Math.PI / 180
    
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    return R * c
  }

  // Calculate total route distance
  const calculateRouteDistance = (routePoints) => {
    let totalDistance = 0
    for (let i = 1; i < routePoints.length; i++) {
      totalDistance += calculateDistance(routePoints[i - 1], routePoints[i])
    }
    return totalDistance
  }


  // Handle PNG reference overlay upload
  const handlePNGUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target.result
        
        // Load image to get dimensions and calculate proper aspect ratio
        const img = new Image()
        img.onload = () => {
          setReferenceOverlay(imageUrl)
          
          // Store aspect ratio for use in resize operations
          const imageAspectRatio = img.width / img.height
          setReferenceAspectRatio(imageAspectRatio)
          
          // Set initial bounds preserving aspect ratio
          if (mapRef.current) {
            const mapBounds = mapRef.current.getBounds()
            const center = mapBounds.getCenter()
            const mapWidth = mapBounds.getEast() - mapBounds.getWest()
            const mapHeight = mapBounds.getNorth() - mapBounds.getSouth()
            
            const mapAspectRatio = mapWidth / mapHeight
            
            let overlayWidth, overlayHeight
            
            // Fit image to map view while preserving aspect ratio
            if (imageAspectRatio > mapAspectRatio) {
              // Image is wider - fit to map width
              overlayWidth = mapWidth * 0.8 // Use 80% of map width
              overlayHeight = overlayWidth / imageAspectRatio
            } else {
              // Image is taller - fit to map height
              overlayHeight = mapHeight * 0.8 // Use 80% of map height
              overlayWidth = overlayHeight * imageAspectRatio
            }
            
            const initialBounds = [
              [center.lat - overlayHeight / 2, center.lng - overlayWidth / 2],
              [center.lat + overlayHeight / 2, center.lng + overlayWidth / 2]
            ]
            setReferenceBounds(initialBounds)
          }
        }
        img.src = imageUrl
      }
      reader.readAsDataURL(file)
    } else {
      alert('Please upload a PNG file')
    }
  }

  // Edge detection using Sobel operator
  const detectEdges = useCallback((grayscale, width, height) => {
    const edges = new Float32Array(width * height)
    
    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx)
            const kidx = (ky + 1) * 3 + (kx + 1)
            gx += grayscale[idx] * sobelX[kidx]
            gy += grayscale[idx] * sobelY[kidx]
          }
        }
        
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy)
      }
    }
    
    return edges
  }, [])

  // Trace contour from edge-detected image
  const traceContour = useCallback((edges, width, height, threshold) => {
    const visited = new Set()
    const contourPoints = []
    
    // Find starting point (first edge pixel from top-left)
    let startX = -1, startY = -1
    for (let y = 0; y < height && startX === -1; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > threshold) {
          startX = x
          startY = y
          break
        }
      }
    }
    
    if (startX === -1) return []
    
    // 8-directional neighbor offsets (clockwise from right)
    const dx = [1, 1, 0, -1, -1, -1, 0, 1]
    const dy = [0, 1, 1, 1, 0, -1, -1, -1]
    
    let x = startX, y = startY
    let lastDir = 0
    const maxPoints = 5000
    
    // Trace the contour
    do {
      const key = `${x},${y}`
      if (!visited.has(key)) {
        visited.add(key)
        contourPoints.push([x / width, y / height]) // Normalize to 0-1
      }
      
      // Find next edge pixel (start search from last direction - 2)
      let found = false
      const startDir = (lastDir + 6) % 8
      
      for (let i = 0; i < 8; i++) {
        const dir = (startDir + i) % 8
        const nx = x + dx[dir]
        const ny = y + dy[dir]
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (edges[ny * width + nx] > threshold && !visited.has(`${nx},${ny}`)) {
            x = nx
            y = ny
            lastDir = dir
            found = true
            break
          }
        }
      }
      
      if (!found) break
      
    } while ((x !== startX || y !== startY) && contourPoints.length < maxPoints)
    
    return contourPoints
  }, [])

  // Simplify path using Douglas-Peucker algorithm
  const simplifyPath = useCallback((points, tolerance) => {
    if (points.length < 3) return points
    
    const sqDist = (p1, p2) => {
      const dx = p1[0] - p2[0]
      const dy = p1[1] - p2[1]
      return dx * dx + dy * dy
    }
    
    const pointToLineDistance = (point, lineStart, lineEnd) => {
      const A = point[0] - lineStart[0]
      const B = point[1] - lineStart[1]
      const C = lineEnd[0] - lineStart[0]
      const D = lineEnd[1] - lineStart[1]
      
      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let param = lenSq !== 0 ? dot / lenSq : -1
      
      let xx, yy
      if (param < 0) {
        xx = lineStart[0]
        yy = lineStart[1]
      } else if (param > 1) {
        xx = lineEnd[0]
        yy = lineEnd[1]
      } else {
        xx = lineStart[0] + param * C
        yy = lineStart[1] + param * D
      }
      
      return sqDist(point, [xx, yy])
    }
    
    const simplifySegment = (start, end) => {
      let maxDist = 0
      let maxIdx = 0
      
      for (let i = start + 1; i < end; i++) {
        const dist = pointToLineDistance(points[i], points[start], points[end])
        if (dist > maxDist) {
          maxDist = dist
          maxIdx = i
        }
      }
      
      if (maxDist > tolerance * tolerance) {
        const left = simplifySegment(start, maxIdx)
        const right = simplifySegment(maxIdx, end)
        return [...left.slice(0, -1), ...right]
      } else {
        return [points[start], points[end]]
      }
    }
    
    return simplifySegment(0, points.length - 1)
  }, [])

  // Trace PNG and snap to roads
  const tracePNGAndSnap = useCallback(async () => {
    if (!referenceOverlay || !referenceBounds) {
      alert('Please upload a PNG image first')
      return
    }
    
    setIsSnappingRoads(true)
    
    try {
      // Load image
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = referenceOverlay
      })
      
      // Create canvas and draw image
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const maxSize = 300 // Resolution for edge detection
      const scale = Math.min(maxSize / img.width, maxSize / img.height)
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      // Get image data and convert to grayscale
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const grayscale = new Uint8Array(canvas.width * canvas.height)
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const alpha = data[i + 3]
        // Consider transparency
        if (alpha < 128) {
          grayscale[i / 4] = 255
        } else {
          grayscale[i / 4] = Math.floor((r + g + b) / 3)
        }
      }
      
      // Detect edges
      const edges = detectEdges(grayscale, canvas.width, canvas.height)
      
      // Find edge threshold (adaptive)
      const edgeValues = Array.from(edges).filter(v => v > 0).sort((a, b) => b - a)
      const edgeThreshold = edgeValues.length > 0 ? edgeValues[Math.floor(edgeValues.length * 0.1)] : 50
      
      // Trace contour
      let contourPoints = traceContour(edges, canvas.width, canvas.height, edgeThreshold)
      
      if (contourPoints.length < 3) {
        // Fallback: try lower threshold
        const lowerThreshold = edgeThreshold * 0.5
        contourPoints = traceContour(edges, canvas.width, canvas.height, lowerThreshold)
      }
      
      if (contourPoints.length < 3) {
        alert('Could not detect outline in the image. Try an image with clearer edges.')
        setIsSnappingRoads(false)
        return
      }
      
      // Simplify path
      const simplifiedPoints = simplifyPath(contourPoints, 0.005)
      
      // Convert to map coordinates
      const bounds = referenceBounds
      const south = bounds[0][0]
      const west = bounds[0][1]
      const north = bounds[1][0]
      const east = bounds[1][1]
      const height = north - south
      const width = east - west
      
      const mapPoints = simplifiedPoints.map(p => {
        // Invert Y (image Y goes down, lat goes up)
        const lat = north - p[1] * height
        const lng = west + p[0] * width
        return [lat, lng]
      }).filter(p => !isNaN(p[0]) && !isNaN(p[1]))
      
      if (mapPoints.length < 2) {
        alert('Not enough points extracted from image')
        setIsSnappingRoads(false)
        return
      }
      
      // Snap to roads
      const snappedPoints = await snapToRoadsOSRM(mapPoints)
      setPoints(snappedPoints)
      
      alert(`Traced ${simplifiedPoints.length} waypoints, snapped to ${snappedPoints.length} road points!`)
      
    } catch (err) {
      console.error('Trace error:', err)
      alert(`Error tracing image: ${err.message}`)
    } finally {
      setIsSnappingRoads(false)
    }
  }, [referenceOverlay, referenceBounds, detectEdges, traceContour, simplifyPath, snapToRoadsOSRM])

  // Process image to extract route points
  const imageToRoute = async (imageDataUrl, desiredMiles) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        if (!mapRef.current) {
          resolve([])
          return
        }

        const bounds = mapRef.current.getBounds()
        const center = bounds.getCenter()
        const ne = bounds.getNorthEast()
        const sw = bounds.getSouthWest()
        
        // Create canvas to process image
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const maxSize = 200 // Higher resolution for better route quality
        const scale = Math.min(maxSize / img.width, maxSize / img.height)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Convert to grayscale
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const grayscale = new Uint8Array(canvas.width * canvas.height)
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const alpha = data[i + 3]
          // Consider transparency - if alpha is low, treat as background
          if (alpha < 128) {
            grayscale[i / 4] = 255 // Treat transparent as white
          } else {
            grayscale[i / 4] = (r + g + b) / 3
          }
        }

        // Find threshold (use adaptive threshold)
        const sorted = Array.from(grayscale).sort((a, b) => a - b)
        const threshold = sorted[Math.floor(sorted.length * 0.25)] // 25th percentile for dark pixels

        // Extract route points by sampling dark pixels
        const route = []
        const step = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 300)) // Adaptive step size
        
        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const idx = y * canvas.width + x
            if (grayscale[idx] < threshold) {
              // Map image coordinates to map coordinates (centered on current view)
              const normalizedX = (x / canvas.width - 0.5)
              const normalizedY = (y / canvas.height - 0.5)
              
              const lat = center.lat + normalizedY * (ne.lat - sw.lat)
              const lng = center.lng + normalizedX * (ne.lng - sw.lng)
              route.push([lat, lng])
            }
          }
        }

        // If not enough points, try finer sampling
        if (route.length < 50 && step > 1) {
          route.length = 0
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              const idx = y * canvas.width + x
              if (grayscale[idx] < threshold) {
                const normalizedX = (x / canvas.width - 0.5)
                const normalizedY = (y / canvas.height - 0.5)
                const lat = center.lat + normalizedY * (ne.lat - sw.lat)
                const lng = center.lng + normalizedX * (ne.lng - sw.lng)
                route.push([lat, lng])
              }
            }
          }
        }

        // Optimize route - remove points that are too close together
        if (route.length > 1) {
          const optimized = [route[0]]
          const minDistance = 0.0001 // Minimum distance between points in degrees
          
          for (let i = 1; i < route.length; i++) {
            const lastPoint = optimized[optimized.length - 1]
            const currentPoint = route[i]
            const dist = Math.sqrt(
              Math.pow(currentPoint[0] - lastPoint[0], 2) +
              Math.pow(currentPoint[1] - lastPoint[1], 2)
            )
            if (dist > minDistance) {
              optimized.push(currentPoint)
            }
          }

          // Calculate actual route distance
          const actualDistance = calculateRouteDistance(optimized)
          
          if (actualDistance > 0 && desiredMiles > 0) {
            // Scale the route to match desired mileage - scale from center to preserve shape
            const scaleFactor = desiredMiles / actualDistance
            
            // Find center of route
            const centerLat = optimized.reduce((sum, p) => sum + p[0], 0) / optimized.length
            const centerLng = optimized.reduce((sum, p) => sum + p[1], 0) / optimized.length
            
            const scaledRoute = optimized.map((point) => {
              const deltaLat = (point[0] - centerLat) * scaleFactor
              const deltaLng = (point[1] - centerLng) * scaleFactor
              return [centerLat + deltaLat, centerLng + deltaLng]
            })
            resolve(scaledRoute)
          } else {
            resolve(optimized)
          }
        } else {
          resolve([])
        }
      }
      img.src = imageDataUrl
    })
  }

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Check if it's a PNG
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPendingImage(event.target.result)
        setShowMileagePrompt(true)
      }
      reader.readAsDataURL(file)
    } else {
      // For non-PNG images, just overlay them
      const reader = new FileReader()
      reader.onload = (event) => {
        setImageOverlay(event.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Process image with mileage
  const processImageWithMileage = async (miles) => {
    if (!pendingImage) return
    
    const mileage = parseFloat(miles)
    if (isNaN(mileage) || mileage <= 0) {
      alert('Please enter a valid mileage greater than 0')
      return
    }

    setIsProcessingImage(true)
    setShowMileagePrompt(false)

    try {
      const routePoints = await imageToRoute(pendingImage, mileage)
      
      if (routePoints && routePoints.length > 0) {
        // Set the points on the map
        setPoints(routePoints)
        
        // Also overlay the image for reference
        setImageOverlay(pendingImage)
        
        // Set image bounds based on route bounds
        if (mapRef.current && routePoints.length > 0) {
          const firstPoint = routePoints[0]
          const bounds = L.latLngBounds([firstPoint, firstPoint])
          routePoints.forEach(point => bounds.extend(point))
          
          // Set image bounds to match route bounds
          setImageBounds([
            [bounds.getSouth(), bounds.getWest()],
            [bounds.getNorth(), bounds.getEast()]
          ])
          
          // Fit map to route bounds
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitBounds(bounds, { padding: [50, 50] })
            }
          }, 100)
        }
        
        alert(`Route generated! Created ${routePoints.length} points for approximately ${mileage.toFixed(1)} miles.`)
      } else {
        alert('Could not extract route from image. Make sure the image has a clear dark path/shape.')
      }
    } catch (error) {
      console.error('Error processing image:', error)
      alert('Error processing image. Please try again.')
    } finally {
      setIsProcessingImage(false)
      setPendingImage(null)
    }
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  title="Search location"
                >
                  🔍
                </button>
                <button
                  onClick={centerOnMyLocation}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  title="Center on my location"
                >
                  📍
                </button>
              </div>
            </div>

            {/* Design Tools Sidebar */}
            <div className="lg:col-span-3 md:col-span-2">
              <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                <h3 className="text-lg font-bold text-indigo-900 mb-4">Design Tools</h3>
                
                {/* PNG Reference Overlay */}
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-gray-700 flex items-center">
                    Reference Overlay (PNG)
                    <Tooltip position="bottom-right" content="Upload a reference image or sketch. PNGs support transparency, allowing you to see the map underneath so you can manually trace your route." />
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={pngFileInputRef}
                      type="file"
                      accept="image/png"
                      onChange={handlePNGUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => pngFileInputRef.current?.click()}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      {referenceOverlay ? 'Re-upload PNG' : 'Upload PNG'}
                    </button>
                    {referenceOverlay && (
                      <button
                        onClick={() => {
                          setReferenceOverlay(null)
                          setReferenceBounds(null)
                          setReferenceAspectRatio(null)
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {referenceOverlay && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Opacity:</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={referenceOpacity}
                          onChange={(e) => setReferenceOpacity(parseFloat(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600 w-12">{Math.round(referenceOpacity * 100)}%</span>
                      </div>
                      <button
                        onClick={tracePNGAndSnap}
                        disabled={isSnappingRoads}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSnappingRoads ? '🔄 Tracing & Snapping...' : '✨ Trace & Snap to Roads'}
                      </button>
                      <p className="text-xs text-gray-500">
                        💡 Position and resize your image, then click to auto-trace the outline and snap to roads!
                      </p>
                    </>
                  )}
                </div>

              </div>
            </div>
            
            {/* Mileage Prompt Modal */}
            {showMileagePrompt && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-xl font-bold mb-4">Enter Desired Route Distance</h3>
                  <p className="text-gray-600 mb-4">
                    How many miles would you like your route to be?
                  </p>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    placeholder="e.g., 5.0"
                    id="mileage-input"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 mb-4"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = document.getElementById('mileage-input')
                        processImageWithMileage(input.value)
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const input = document.getElementById('mileage-input')
                        processImageWithMileage(input.value)
                      }}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Generate Route
                    </button>
                    <button
                      onClick={() => {
                        setShowMileagePrompt(false)
                        setPendingImage(null)
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Drawing Tools */}
            <div className="lg:col-span-3 md:col-span-2">
              <div className={`border-2 rounded-lg p-4 ${isDrawingMode ? 'border-red-400 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
                <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
                  ✏️ Drawing Tools
                  {isDrawingMode && <span className="text-sm font-normal text-red-600 bg-red-100 px-2 py-1 rounded">Drawing Mode Active</span>}
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Drawing Mode Toggle */}
                  <button
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                    className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                      isDrawingMode 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {isDrawingMode ? '⏹ Stop Drawing' : '✏️ Start Drawing'}
                  </button>

                  {/* Undo Button */}
                  <button
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ↩️ Undo
                  </button>

                  {/* Redo Button */}
                  <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ↪️ Redo
                  </button>

                  {/* Delete Last Line */}
                  <button
                    onClick={deleteLastLine}
                    disabled={drawnLines.length === 0}
                    className="px-4 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🗑️ Delete Last Line
                  </button>

                  {/* Clear All Drawings */}
                  <button
                    onClick={clearAllDrawings}
                    disabled={drawnLines.length === 0}
                    className="px-4 py-3 bg-red-400 text-white rounded-lg font-semibold hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🧹 Clear All
                  </button>

                  {/* Convert to Route */}
                  <button
                    onClick={convertDrawingsToRoute}
                    disabled={drawnLines.length === 0 || isSnappingRoads}
                    className="px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed md:col-span-2"
                  >
                    {isSnappingRoads ? 'Snapping to Roads...' : `Convert to Route (${drawnLines.length} lines)${snapToRoads ? ' + Snap' : ''}`}
                  </button>
                </div>

                {/* Drawing Info */}
                {drawnLines.length > 0 && (
                  <div className="mt-3 text-sm text-gray-600">
                    <span>Lines drawn: <strong>{drawnLines.length}</strong></span>
                    <span className="mx-2">|</span>
                    <span>Total points: <strong>{drawnLines.reduce((sum, line) => sum + line.length, 0)}</strong></span>
                  </div>
                )}

                {isDrawingMode && (
                  <p className="mt-3 text-sm text-orange-700 bg-orange-100 p-2 rounded">
                    💡 <strong>Tip:</strong> Click and drag on the map to draw freehand. Release to complete a line segment.
                  </p>
                )}
              </div>
            </div>

            {/* Snap to Roads Toggle */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-700">
                Route Options
                <Tooltip content={
                  <>
                    When enabled, this uses the Open Source Routing Machine (OSRM) to automatically align your drawing with real-world streets and paths. This ensures your Strava art follows runnable roads rather than cutting through buildings or water, making your route safe and accurate to navigate! You should enable this for every route unless it's in an open field or body of water.
                  </>
                } />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapToRoads}
                  onChange={(e) => setSnapToRoads(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-gray-700">Snap to Roads (OSRM)</span>
              </label>
              {isRouting && (
                <p className="text-sm text-indigo-600">Routing...</p>
              )}
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
              <label className="font-semibold text-gray-700">
                Export
                <Tooltip position="top-left" content={
                  <>
                    This button converts your design into a GPS Exchange Format (.gpx) file. You can upload this file directly to Strava, Garmin, Organic Maps, or other fitness apps to follow your custom artwork as a guided route during your next run or ride!
                  </>
                } />
              </label>
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

        {/* Route Distance Display */}
        {routeDistance !== null && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 mb-4 shadow-xl">
            <div className="flex items-center justify-center gap-4 text-white">
              <span className="text-lg font-medium">Route Distance:</span>
              <span className="text-3xl font-bold">
                {routeDistance.toFixed(2)} mi
              </span>
              <span className="text-xl opacity-80">
                ({(routeDistance * 1.60934).toFixed(2)} km)
              </span>
            </div>
          </div>
        )}

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
            
            {/* Reference Overlay (PNG) */}
            {referenceOverlay && referenceBounds && (
              <ResizableImageOverlay
                url={referenceOverlay}
                bounds={referenceBounds}
                opacity={referenceOpacity}
                aspectRatio={referenceAspectRatio}
                onBoundsChange={setReferenceBounds}
              />
            )}
            
            
            {/* Legacy Image Overlay (for PNG route generation) */}
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

            {/* Route Polyline */}
            {points.length > 1 && (
              <Polyline
                positions={points}
                color="#667eea"
                weight={4}
                opacity={0.8}
              />
            )}

            {/* Drawn Lines */}
            {drawnLines.map((line, index) => (
              <Polyline
                key={`drawn-${index}`}
                positions={line}
                color="#ef4444"
                weight={3}
                opacity={0.9}
              />
            ))}

            {/* Current Drawing Line */}
            {currentLine.length > 1 && (
              <Polyline
                positions={currentLine}
                color="#f97316"
                weight={3}
                opacity={0.8}
                dashArray="5, 10"
              />
            )}

            {/* Map Click Handler */}
            <MapClickHandler onMapClick={handleMapClick} isDrawingMode={isDrawingMode} />

            {/* Drawing Handler */}
            {isDrawingMode && (
              <DrawingHandler
                isDrawingMode={isDrawingMode}
                currentLineRef={currentLineRef}
                onLineComplete={handleLineComplete}
                setCurrentLine={setCurrentLine}
              />
            )}
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
              <span><strong>Trace & Snap:</strong> Position your PNG, then click to auto-trace outline and snap to roads</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span><strong>Drawing Mode:</strong> Click "Start Drawing" then draw freely on the map with your mouse</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Use Undo/Redo to correct mistakes, and "Convert to Route" when done</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Enable "Snap to Roads" to automatically route along streets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600">→</span>
              <span>Export your route as GPX for use in Strava Premium or Organic Maps (free)</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4">
        <p className="text-white text-sm opacity-75">Built by Dennis Gavrilenko in 2025</p>
      </footer>
    </div>
  )
}

export default App

