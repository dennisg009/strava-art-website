import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { ImageOverlay } from 'react-leaflet'

function ResizableImageOverlay({ url, bounds, opacity, aspectRatio, onBoundsChange }) {
  const map = useMap()
  const overlayRef = useRef(null)
  const markersRef = useRef([])
  const groupRef = useRef(null)
  const dragStartBoundsRef = useRef(null)
  const dragStartCenterRef = useRef(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!bounds || !map) return
    if (isDraggingRef.current) return // Don't recreate markers during drag

    // Clean up previous markers
    if (groupRef.current) {
      groupRef.current.clearLayers()
      map.removeLayer(groupRef.current)
    }
    
    // Create a new layer group for all markers
    groupRef.current = L.layerGroup().addTo(map)
    markersRef.current = []

    const centerLat = (bounds[0][0] + bounds[1][0]) / 2
    const centerLng = (bounds[0][1] + bounds[1][1]) / 2
    const currentWidth = bounds[1][1] - bounds[0][1]
    const currentHeight = bounds[1][0] - bounds[0][0]

    // Corner handles (diagonal resize - preserve aspect ratio)
    const cornerPositions = [
      [bounds[0][0], bounds[0][1]], // Southwest (index 0)
      [bounds[0][0], bounds[1][1]], // Northwest (index 1)
      [bounds[1][0], bounds[1][1]], // Northeast (index 2)
      [bounds[1][0], bounds[0][1]]  // Southeast (index 3)
    ]

    const cornerCursors = ['sw-resize', 'nw-resize', 'ne-resize', 'se-resize']

    cornerPositions.forEach((corner, index) => {
      const icon = L.divIcon({
        className: 'resize-handle-corner',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })

      const marker = L.marker(corner, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })

      marker.on('dragstart', () => {
        isDraggingRef.current = true
        dragStartBoundsRef.current = bounds
        dragStartCenterRef.current = { lat: centerLat, lng: centerLng }
      })

      marker.on('drag', () => {
        if (!aspectRatio || !dragStartBoundsRef.current) return
        
        const draggedPos = marker.getLatLng()
        const startCenter = dragStartCenterRef.current
        const startBounds = dragStartBoundsRef.current
        const startHeight = startBounds[1][0] - startBounds[0][0]
        const startWidth = startBounds[1][1] - startBounds[0][1]
        
        // Calculate distance from original center
        const deltaLat = draggedPos.lat - startCenter.lat
        const deltaLng = draggedPos.lng - startCenter.lng
        
        // Calculate diagonal distance from center
        const diagonalDistance = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng)
        const startDiagonal = Math.sqrt((startHeight / 2) ** 2 + (startWidth / 2) ** 2)
        
        // Scale factor based on diagonal distance (maintains aspect ratio)
        const scaleFactor = startDiagonal > 0 ? diagonalDistance / startDiagonal : 1
        
        // Calculate new dimensions maintaining aspect ratio
        const newHeight = Math.max(startHeight * scaleFactor, 0.0001)
        const newWidth = newHeight * aspectRatio
        
        const newBounds = [
          [startCenter.lat - newHeight / 2, startCenter.lng - newWidth / 2],
          [startCenter.lat + newHeight / 2, startCenter.lng + newWidth / 2]
        ]
        
        if (onBoundsChange && newHeight > 0.0001 && newWidth > 0.0001) {
          onBoundsChange(newBounds)
        }
      })

      marker.on('dragend', () => {
        isDraggingRef.current = false
        dragStartBoundsRef.current = null
        dragStartCenterRef.current = null
      })

      marker.addTo(groupRef.current)
      markersRef.current.push(marker)
    })

    // Edge handles (horizontal/vertical resize)
    const edgePositions = [
      [centerLat, bounds[0][1]], // West (index 4)
      [centerLat, bounds[1][1]], // East (index 5)
      [bounds[0][0], centerLng], // South (index 6)
      [bounds[1][0], centerLng]  // North (index 7)
    ]

    const edgeHandlers = [
      (newLng) => { // West - only change width (allow stretching)
        const newWidth = bounds[1][1] - newLng
        return [
          [bounds[0][0], newLng],
          [bounds[1][0], bounds[1][1]]
        ]
      },
      (newLng) => { // East - only change width (allow stretching)
        const newWidth = newLng - bounds[0][1]
        return [
          [bounds[0][0], bounds[0][1]],
          [bounds[1][0], newLng]
        ]
      },
      (newLat) => { // South - only change height (allow stretching)
        const newHeight = bounds[1][0] - newLat
        return [
          [newLat, bounds[0][1]],
          [bounds[1][0], bounds[1][1]]
        ]
      },
      (newLat) => { // North - only change height (allow stretching)
        const newHeight = newLat - bounds[0][0]
        return [
          [bounds[0][0], bounds[0][1]],
          [newLat, bounds[1][1]]
        ]
      }
    ]

    edgePositions.forEach((edge, index) => {
      const icon = L.divIcon({
        className: 'resize-handle-edge',
        iconSize: index < 2 ? [8, 20] : [20, 8], // Horizontal for west/east, vertical for south/north
        iconAnchor: index < 2 ? [4, 10] : [10, 4]
      })

      const marker = L.marker(edge, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })

      marker.on('dragstart', () => {
        isDraggingRef.current = true
        dragStartBoundsRef.current = bounds
        dragStartCenterRef.current = { lat: centerLat, lng: centerLng }
      })

      marker.on('drag', () => {
        if (!dragStartBoundsRef.current) return
        
        const draggedPos = marker.getLatLng()
        const startBounds = dragStartBoundsRef.current
        
        if (index < 2) {
          // West/East - constrain to horizontal movement
          const newLng = draggedPos.lng
          let newBounds
          if (index === 0) { // West
            newBounds = [
              [startBounds[0][0], newLng],
              [startBounds[1][0], startBounds[1][1]]
            ]
          } else { // East
            newBounds = [
              [startBounds[0][0], startBounds[0][1]],
              [startBounds[1][0], newLng]
            ]
          }
          if (newBounds && newBounds[0][1] < newBounds[1][1]) {
            onBoundsChange(newBounds)
          }
        } else {
          // South/North - constrain to vertical movement
          const newLat = draggedPos.lat
          let newBounds
          if (index === 2) { // South
            newBounds = [
              [newLat, startBounds[0][1]],
              [startBounds[1][0], startBounds[1][1]]
            ]
          } else { // North
            newBounds = [
              [startBounds[0][0], startBounds[0][1]],
              [newLat, startBounds[1][1]]
            ]
          }
          if (newBounds && newBounds[0][0] < newBounds[1][0]) {
            onBoundsChange(newBounds)
          }
        }
      })

      marker.on('dragend', () => {
        isDraggingRef.current = false
        dragStartBoundsRef.current = null
        dragStartCenterRef.current = null
      })

      marker.addTo(groupRef.current)
      markersRef.current.push(marker)
    })

    // Center drag handle
    const center = [centerLat, centerLng]
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

    centerMarker.on('dragstart', () => {
      isDraggingRef.current = true
      dragStartBoundsRef.current = bounds
      dragStartCenterRef.current = { lat: centerLat, lng: centerLng }
    })

    centerMarker.on('drag', () => {
      if (!dragStartBoundsRef.current) return
      
      const newCenter = centerMarker.getLatLng()
      const startBounds = dragStartBoundsRef.current
      const startHeight = startBounds[1][0] - startBounds[0][0]
      const startWidth = startBounds[1][1] - startBounds[0][1]
      
      const newBounds = [
        [newCenter.lat - startHeight / 2, newCenter.lng - startWidth / 2],
        [newCenter.lat + startHeight / 2, newCenter.lng + startWidth / 2]
      ]
      if (onBoundsChange) {
        onBoundsChange(newBounds)
      }
    })

    centerMarker.on('dragend', () => {
      isDraggingRef.current = false
      dragStartBoundsRef.current = null
      dragStartCenterRef.current = null
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
  }, [bounds, map, onBoundsChange, aspectRatio])

  return bounds ? <ImageOverlay ref={overlayRef} url={url} bounds={bounds} opacity={opacity} /> : null
}

export default ResizableImageOverlay
