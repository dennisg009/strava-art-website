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

    // Create a layer group for all markers
    if (!groupRef.current) {
      groupRef.current = L.layerGroup().addTo(map)
    } else {
      groupRef.current.clearLayers()
    }
    
    markersRef.current = []

    // Create corner markers for resizing
    const corners = [
      [bounds[0][0], bounds[0][1]], // Southwest
      [bounds[0][0], bounds[1][1]], // Northwest  
      [bounds[1][0], bounds[1][1]], // Northeast
      [bounds[1][0], bounds[0][1]]  // Southeast
    ]

    corners.forEach((corner) => {
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
        if (markersRef.current.length >= 4) {
          const newCorners = [
            markersRef.current[0].getLatLng(), // SW
            markersRef.current[1].getLatLng(), // NW
            markersRef.current[2].getLatLng(), // NE
            markersRef.current[3].getLatLng()  // SE
          ]
          const newBounds = [
            [Math.min(newCorners[0].lat, newCorners[3].lat), Math.min(newCorners[0].lng, newCorners[1].lng)],
            [Math.max(newCorners[1].lat, newCorners[2].lat), Math.max(newCorners[2].lng, newCorners[3].lng)]
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

