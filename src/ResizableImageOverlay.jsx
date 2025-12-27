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
    const updateOverlayBounds = (newBounds, skipMarkerUpdate = false) => {
      if (overlayRef.current && overlayRef.current.leafletElement) {
        const leafletBounds = L.latLngBounds(newBounds)
        const overlay = overlayRef.current.leafletElement
        
        // Update bounds directly and force immediate redraw
        overlay._bounds = leafletBounds
        overlay._update()
        
        // Also update marker positions for handles to follow (but skip the one being dragged)
        if (!skipMarkerUpdate && markersRef.current.length >= 8) {
          const newCenterLat = (newBounds[0][0] + newBounds[1][0]) / 2
          const newCenterLng = (newBounds[0][1] + newBounds[1][1]) / 2
          
          // Update corner markers
          markersRef.current[0].setLatLng([newBounds[0][0], newBounds[0][1]]) // SW
          markersRef.current[1].setLatLng([newBounds[0][0], newBounds[1][1]]) // NW
          markersRef.current[2].setLatLng([newBounds[1][0], newBounds[1][1]]) // NE
          markersRef.current[3].setLatLng([newBounds[1][0], newBounds[0][1]]) // SE
          
          // Update edge markers
          markersRef.current[4].setLatLng([newCenterLat, newBounds[0][1]]) // West
          markersRef.current[5].setLatLng([newCenterLat, newBounds[1][1]]) // East
          markersRef.current[6].setLatLng([newBounds[0][0], newCenterLng]) // South
          markersRef.current[7].setLatLng([newBounds[1][0], newCenterLng]) // North
          
          // Update center marker
          if (markersRef.current.length > 8) {
            markersRef.current[8].setLatLng([newCenterLat, newCenterLng])
          }
        }
      }
    }

    // Corner handles (diagonal resize - preserve aspect ratio)
    const cornerPositions = [
      [bounds[0][0], bounds[0][1]], // Southwest (index 0)
      [bounds[0][0], bounds[1][1]], // Northwest (index 1)
      [bounds[1][0], bounds[1][1]], // Northeast (index 2)
      [bounds[1][0], bounds[0][1]]  // Southeast (index 3)
    ]

    // Cursor directions and CSS classes: SW->NE, NW->SE, NE->SW, SE->NW
    const cornerCursors = ['ne-resize', 'se-resize', 'sw-resize', 'nw-resize']
    const cornerClasses = ['resize-handle-corner-sw', 'resize-handle-corner-nw', 'resize-handle-corner-ne', 'resize-handle-corner-se']

    cornerPositions.forEach((corner, index) => {
      const icon = L.divIcon({
        className: `resize-handle-corner ${cornerClasses[index]}`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        html: '' // Empty HTML, we use CSS ::before and ::after
      })

      const marker = L.marker(corner, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })
      
      // Set cursor style after marker is added to map
      setTimeout(() => {
        const el = marker.getElement()
        if (el) el.style.cursor = cornerCursors[index]
      }, 0)

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
          updateOverlayBounds(newBounds, true) // Skip marker update during corner drag
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

    // Cursor directions: West, East (horizontal), South, North (vertical)
    const edgeCursors = ['ew-resize', 'ew-resize', 'ns-resize', 'ns-resize']
    
    edgePositions.forEach((edge, index) => {
      // Index 0=West, 1=East (horizontal - tall rectangle), 2=South, 3=North (vertical - wide rectangle)
      const isHorizontal = index < 2
      const icon = L.divIcon({
        className: 'resize-handle-edge',
        iconSize: isHorizontal ? [8, 20] : [20, 8],
        iconAnchor: isHorizontal ? [4, 10] : [10, 4]
      })

      const marker = L.marker(edge, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })
      
      // Set cursor style after marker is added to map
      setTimeout(() => {
        const el = marker.getElement()
        if (el) el.style.cursor = edgeCursors[index]
      }, 0)

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
          updateOverlayBounds(newBounds, true) // Skip marker update during edge drag
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
      updateOverlayBounds(newBounds, true) // Skip marker update during center drag
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
