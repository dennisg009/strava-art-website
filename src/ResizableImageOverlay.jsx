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

    const centerLat = (bounds[0][0] + bounds[1][0]) / 2
    const centerLng = (bounds[0][1] + bounds[1][1]) / 2
    const currentWidth = bounds[1][1] - bounds[0][1]
    const currentHeight = bounds[1][0] - bounds[0][0]

    // Update overlay bounds directly during drag (don't trigger React re-render)
    const updateOverlayBounds = (newBounds) => {
      if (overlayRef.current && overlayRef.current.leafletElement) {
        const leafletBounds = L.latLngBounds(newBounds)
        overlayRef.current.leafletElement.setBounds(leafletBounds)
      }
    }

    // Corner handles (diagonal resize - preserve aspect ratio)
    const cornerPositions = [
      [bounds[0][0], bounds[0][1]], // Southwest (index 0)
      [bounds[0][0], bounds[1][1]], // Northwest (index 1)
      [bounds[1][0], bounds[1][1]], // Northeast (index 2)
      [bounds[1][0], bounds[0][1]]  // Southeast (index 3)
    ]

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
        dragStartBoundsRef.current = bounds
      })

      marker.on('drag', () => {
        if (!aspectRatio || !dragStartBoundsRef.current) return
        
        const draggedPos = marker.getLatLng()
        const startBounds = dragStartBoundsRef.current
        const startCenter = {
          lat: (startBounds[0][0] + startBounds[1][0]) / 2,
          lng: (startBounds[0][1] + startBounds[1][1]) / 2
        }
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
        
        if (newHeight > 0.0001 && newWidth > 0.0001) {
          updateOverlayBounds(newBounds)
        }
      })

      marker.on('dragend', () => {
        if (!aspectRatio || !dragStartBoundsRef.current) return
        
        const draggedPos = marker.getLatLng()
        const startBounds = dragStartBoundsRef.current
        const startCenter = {
          lat: (startBounds[0][0] + startBounds[1][0]) / 2,
          lng: (startBounds[0][1] + startBounds[1][1]) / 2
        }
        const startHeight = startBounds[1][0] - startBounds[0][0]
        const startWidth = startBounds[1][1] - startBounds[0][1]
        
        const deltaLat = draggedPos.lat - startCenter.lat
        const deltaLng = draggedPos.lng - startCenter.lng
        const diagonalDistance = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng)
        const startDiagonal = Math.sqrt((startHeight / 2) ** 2 + (startWidth / 2) ** 2)
        const scaleFactor = startDiagonal > 0 ? diagonalDistance / startDiagonal : 1
        const newHeight = Math.max(startHeight * scaleFactor, 0.0001)
        const newWidth = newHeight * aspectRatio
        
        const newBounds = [
          [startCenter.lat - newHeight / 2, startCenter.lng - newWidth / 2],
          [startCenter.lat + newHeight / 2, startCenter.lng + newWidth / 2]
        ]
        
        if (onBoundsChange && newHeight > 0.0001 && newWidth > 0.0001) {
          onBoundsChange(newBounds)
        }
        dragStartBoundsRef.current = null
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

    edgePositions.forEach((edge, index) => {
      const icon = L.divIcon({
        className: 'resize-handle-edge',
        iconSize: index < 2 ? [8, 20] : [20, 8],
        iconAnchor: index < 2 ? [4, 10] : [10, 4]
      })

      const marker = L.marker(edge, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })

      marker.on('dragstart', () => {
        dragStartBoundsRef.current = bounds
      })

      marker.on('drag', () => {
        if (!dragStartBoundsRef.current) return
        
        const draggedPos = marker.getLatLng()
        const startBounds = dragStartBoundsRef.current
        
        let newBounds
        if (index === 0) { // West
          newBounds = [
            [startBounds[0][0], draggedPos.lng],
            [startBounds[1][0], startBounds[1][1]]
          ]
        } else if (index === 1) { // East
          newBounds = [
            [startBounds[0][0], startBounds[0][1]],
            [startBounds[1][0], draggedPos.lng]
          ]
        } else if (index === 2) { // South
          newBounds = [
            [draggedPos.lat, startBounds[0][1]],
            [startBounds[1][0], startBounds[1][1]]
          ]
        } else { // North
          newBounds = [
            [startBounds[0][0], startBounds[0][1]],
            [draggedPos.lat, startBounds[1][1]]
          ]
        }
        
        if (newBounds && newBounds[0][0] < newBounds[1][0] && newBounds[0][1] < newBounds[1][1]) {
          updateOverlayBounds(newBounds)
        }
      })

      marker.on('dragend', () => {
        if (!dragStartBoundsRef.current) return
        
        const draggedPos = marker.getLatLng()
        const startBounds = dragStartBoundsRef.current
        
        let newBounds
        if (index === 0) { // West
          newBounds = [
            [startBounds[0][0], draggedPos.lng],
            [startBounds[1][0], startBounds[1][1]]
          ]
        } else if (index === 1) { // East
          newBounds = [
            [startBounds[0][0], startBounds[0][1]],
            [startBounds[1][0], draggedPos.lng]
          ]
        } else if (index === 2) { // South
          newBounds = [
            [draggedPos.lat, startBounds[0][1]],
            [startBounds[1][0], startBounds[1][1]]
          ]
        } else { // North
          newBounds = [
            [startBounds[0][0], startBounds[0][1]],
            [draggedPos.lat, startBounds[1][1]]
          ]
        }
        
        if (onBoundsChange && newBounds && newBounds[0][0] < newBounds[1][0] && newBounds[0][1] < newBounds[1][1]) {
          onBoundsChange(newBounds)
        }
        dragStartBoundsRef.current = null
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
      dragStartBoundsRef.current = bounds
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
      updateOverlayBounds(newBounds)
    })

    centerMarker.on('dragend', () => {
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
      dragStartBoundsRef.current = null
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
