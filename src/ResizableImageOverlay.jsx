import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { ImageOverlay } from 'react-leaflet'

function ResizableImageOverlay({ url, bounds, opacity, onBoundsChange }) {
  const map = useMap()
  const overlayRef = useRef(null)
  const markersRef = useRef([])
  const groupRef = useRef(null)

  useEffect(() => {
    if (!bounds || !map) return

    // Clean up previous markers
    if (groupRef.current) {
      groupRef.current.clearLayers()
      map.removeLayer(groupRef.current)
    }
    
    // Create a new layer group for all markers
    groupRef.current = L.layerGroup().addTo(map)
    markersRef.current = []

    // Create corner markers for resizing (store indices for reference)
    const cornerPositions = [
      [bounds[0][0], bounds[0][1]], // Southwest (index 0)
      [bounds[0][0], bounds[1][1]], // Northwest (index 1)
      [bounds[1][0], bounds[1][1]], // Northeast (index 2)
      [bounds[1][0], bounds[0][1]]  // Southeast (index 3)
    ]

    cornerPositions.forEach((corner, index) => {
      const icon = L.divIcon({
        className: 'resize-handle',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })

      const marker = L.marker(corner, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })

      marker.on('drag', () => {
        // Get current positions of all corner markers (they update in real-time)
        const cornerMarkers = markersRef.current.slice(0, 4)
        const corners = cornerMarkers.map(m => m.getLatLng())
        
        // Calculate new bounds from all corner positions
        const lats = corners.map(c => c.lat)
        const lngs = corners.map(c => c.lng)
        
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        
        // Only update if bounds are valid
        if (minLat < maxLat && minLng < maxLng) {
          const newBounds = [
            [minLat, minLng],
            [maxLat, maxLng]
          ]
          if (onBoundsChange) {
            onBoundsChange(newBounds)
          }
        }
      })

      marker.addTo(groupRef.current)
      markersRef.current.push(marker)
    })

    // Make overlay draggable by adding a center marker
    const center = [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2
    ]

    const centerIcon = L.divIcon({
      className: 'drag-handle',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })

    const centerMarker = L.marker(center, {
      icon: centerIcon,
      draggable: true,
      zIndexOffset: 1000
    })

    centerMarker.on('drag', () => {
      const newCenter = centerMarker.getLatLng()
      const latDiff = bounds[1][0] - bounds[0][0]
      const lngDiff = bounds[1][1] - bounds[0][1]
      const newBounds = [
        [newCenter.lat - latDiff / 2, newCenter.lng - lngDiff / 2],
        [newCenter.lat + latDiff / 2, newCenter.lng + lngDiff / 2]
      ]
      if (onBoundsChange) {
        onBoundsChange(newBounds)
      }
    })

    centerMarker.addTo(groupRef.current)
    markersRef.current.push(centerMarker)

    return () => {
      if (groupRef.current) {
        groupRef.current.clearLayers()
        map.removeLayer(groupRef.current)
        groupRef.current = null
      }
      markersRef.current = []
    }
  }, [bounds, map, onBoundsChange])

  return bounds ? <ImageOverlay ref={overlayRef} url={url} bounds={bounds} opacity={opacity} /> : null
}

export default ResizableImageOverlay

