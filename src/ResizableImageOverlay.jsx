import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { ImageOverlay } from 'react-leaflet'

function ResizableImageOverlay({ url, bounds, opacity, aspectRatio, onBoundsChange }) {
  const map = useMap()
  const overlayRef = useRef(null)
  const markersRef = useRef([])
  const groupRef = useRef(null)
  const isDraggingImageRef = useRef(false)
  const dragStartPosRef = useRef(null)

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

    // Update overlay bounds directly during drag for real-time visual feedback
    const updateOverlayBoundsVisually = (newBounds) => {
      if (overlayRef.current && overlayRef.current.leafletElement) {
        const overlay = overlayRef.current.leafletElement
        overlay.setBounds(newBounds)
      }
    }

    // Commit bounds change to React state (call on dragend only)
    const commitBoundsChange = (newBounds) => {
      if (onBoundsChange) {
        onBoundsChange(newBounds)
      }
    }

    // Update marker positions without triggering re-render
    const updateMarkerPositions = (newBounds) => {
      if (markersRef.current.length < 9) return
      
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
      markersRef.current[8].setLatLng([newCenterLat, newCenterLng])
    }

    // Corner handles (diagonal resize - preserve aspect ratio)
    const cornerPositions = [
      [bounds[0][0], bounds[0][1]], // Southwest (index 0)
      [bounds[0][0], bounds[1][1]], // Northwest (index 1)
      [bounds[1][0], bounds[1][1]], // Northeast (index 2)
      [bounds[1][0], bounds[0][1]]  // Southeast (index 3)
    ]

    // Cursor directions and CSS classes for corners
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

      let dragStartBounds = null

      marker.on('dragstart', () => {
        dragStartBounds = bounds
      })

      marker.on('drag', () => {
        if (!aspectRatio || !dragStartBounds) return
        
        const draggedPos = marker.getLatLng()
        const startCenter = {
          lat: (dragStartBounds[0][0] + dragStartBounds[1][0]) / 2,
          lng: (dragStartBounds[0][1] + dragStartBounds[1][1]) / 2
        }
        const startHeight = dragStartBounds[1][0] - dragStartBounds[0][0]
        const startWidth = dragStartBounds[1][1] - dragStartBounds[0][1]
        
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
          updateOverlayBoundsVisually(newBounds)
          updateMarkerPositions(newBounds)
        }
      })

      marker.on('dragend', () => {
        if (!aspectRatio || !dragStartBounds) return
        
        const draggedPos = marker.getLatLng()
        const startCenter = {
          lat: (dragStartBounds[0][0] + dragStartBounds[1][0]) / 2,
          lng: (dragStartBounds[0][1] + dragStartBounds[1][1]) / 2
        }
        const startHeight = dragStartBounds[1][0] - dragStartBounds[0][0]
        const startWidth = dragStartBounds[1][1] - dragStartBounds[0][1]
        
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
        
        if (newHeight > 0.0001 && newWidth > 0.0001) {
          commitBoundsChange(newBounds)
        }
        dragStartBounds = null
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

    const edgeCursors = ['ew-resize', 'ew-resize', 'ns-resize', 'ns-resize']

    edgePositions.forEach((edge, index) => {
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

      setTimeout(() => {
        const el = marker.getElement()
        if (el) el.style.cursor = edgeCursors[index]
      }, 0)

      let dragStartBounds = null

      marker.on('dragstart', () => {
        dragStartBounds = bounds
      })

      marker.on('drag', () => {
        if (!dragStartBounds) return
        
        const draggedPos = marker.getLatLng()
        
        let newBounds
        if (index === 0) { // West
          newBounds = [
            [dragStartBounds[0][0], draggedPos.lng],
            [dragStartBounds[1][0], dragStartBounds[1][1]]
          ]
        } else if (index === 1) { // East
          newBounds = [
            [dragStartBounds[0][0], dragStartBounds[0][1]],
            [dragStartBounds[1][0], draggedPos.lng]
          ]
        } else if (index === 2) { // South
          newBounds = [
            [draggedPos.lat, dragStartBounds[0][1]],
            [dragStartBounds[1][0], dragStartBounds[1][1]]
          ]
        } else { // North
          newBounds = [
            [dragStartBounds[0][0], dragStartBounds[0][1]],
            [draggedPos.lat, dragStartBounds[1][1]]
          ]
        }
        
        if (newBounds && newBounds[0][0] < newBounds[1][0] && newBounds[0][1] < newBounds[1][1]) {
          updateOverlayBoundsVisually(newBounds)
          updateMarkerPositions(newBounds)
        }
      })

      marker.on('dragend', () => {
        if (!dragStartBounds) return
        
        const draggedPos = marker.getLatLng()
        
        let newBounds
        if (index === 0) { // West
          newBounds = [
            [dragStartBounds[0][0], draggedPos.lng],
            [dragStartBounds[1][0], dragStartBounds[1][1]]
          ]
        } else if (index === 1) { // East
          newBounds = [
            [dragStartBounds[0][0], dragStartBounds[0][1]],
            [dragStartBounds[1][0], draggedPos.lng]
          ]
        } else if (index === 2) { // South
          newBounds = [
            [draggedPos.lat, dragStartBounds[0][1]],
            [dragStartBounds[1][0], dragStartBounds[1][1]]
          ]
        } else { // North
          newBounds = [
            [dragStartBounds[0][0], dragStartBounds[0][1]],
            [draggedPos.lat, dragStartBounds[1][1]]
          ]
        }
        
        if (newBounds && newBounds[0][0] < newBounds[1][0] && newBounds[0][1] < newBounds[1][1]) {
          commitBoundsChange(newBounds)
        }
        dragStartBounds = null
      })

      marker.addTo(groupRef.current)
      markersRef.current.push(marker)
    })

    // Center drag handle (larger and more visible)
    const center = [centerLat, centerLng]
    const centerIcon = L.divIcon({
      className: 'drag-handle',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })

    const centerMarker = L.marker(center, {
      icon: centerIcon,
      draggable: true,
      zIndexOffset: 1000
    })

    let dragStartBounds = null

    centerMarker.on('dragstart', () => {
      dragStartBounds = bounds
    })

    centerMarker.on('drag', () => {
      if (!dragStartBounds) return
      
      const newCenter = centerMarker.getLatLng()
      const startHeight = dragStartBounds[1][0] - dragStartBounds[0][0]
      const startWidth = dragStartBounds[1][1] - dragStartBounds[0][1]
      
      const newBounds = [
        [newCenter.lat - startHeight / 2, newCenter.lng - startWidth / 2],
        [newCenter.lat + startHeight / 2, newCenter.lng + startWidth / 2]
      ]
      updateOverlayBoundsVisually(newBounds)
      updateMarkerPositions(newBounds)
    })

    centerMarker.on('dragend', () => {
      if (!dragStartBounds) return
      
      const newCenter = centerMarker.getLatLng()
      const startHeight = dragStartBounds[1][0] - dragStartBounds[0][0]
      const startWidth = dragStartBounds[1][1] - dragStartBounds[0][1]
      
      const newBounds = [
        [newCenter.lat - startHeight / 2, newCenter.lng - startWidth / 2],
        [newCenter.lat + startHeight / 2, newCenter.lng + startWidth / 2]
      ]
      commitBoundsChange(newBounds)
      dragStartBounds = null
    })

    centerMarker.addTo(groupRef.current)
    markersRef.current.push(centerMarker)

    // Make the entire image overlay draggable
    const setupImageDragging = () => {
      if (!overlayRef.current || !overlayRef.current.leafletElement) return
      
      const overlay = overlayRef.current.leafletElement
      const imageElement = overlay.getElement()
      
      if (!imageElement) {
        // If image isn't ready yet, try again in a bit
        setTimeout(setupImageDragging, 100)
        return
      }

      // Make image show move cursor
      imageElement.style.cursor = 'move'
      
      const onMouseDown = (e) => {
        // Don't drag if clicking on a handle
        if (e.target.classList.contains('resize-handle-corner') || 
            e.target.classList.contains('resize-handle-edge') ||
            e.target.classList.contains('drag-handle')) {
          return
        }
        
        isDraggingImageRef.current = true
        dragStartPosRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          bounds: bounds
        }
        imageElement.style.cursor = 'grabbing'
        e.preventDefault()
        e.stopPropagation()
      }

      const onMouseMove = (e) => {
        if (!isDraggingImageRef.current || !dragStartPosRef.current) return
        
        const startBounds = dragStartPosRef.current.bounds
        const deltaX = e.clientX - dragStartPosRef.current.mouseX
        const deltaY = e.clientY - dragStartPosRef.current.mouseY
        
        // Convert pixel movement to lat/lng movement
        const point1 = map.latLngToContainerPoint([startBounds[0][0], startBounds[0][1]])
        const point2 = map.containerPointToLatLng([point1.x + deltaX, point1.y + deltaY])
        
        const deltaLat = point2.lat - startBounds[0][0]
        const deltaLng = point2.lng - startBounds[0][1]
        
        const newBounds = [
          [startBounds[0][0] + deltaLat, startBounds[0][1] + deltaLng],
          [startBounds[1][0] + deltaLat, startBounds[1][1] + deltaLng]
        ]
        
        updateOverlayBoundsVisually(newBounds)
        updateMarkerPositions(newBounds)
        
        e.preventDefault()
        e.stopPropagation()
      }

      const onMouseUp = (e) => {
        if (!isDraggingImageRef.current || !dragStartPosRef.current) return
        
        const startBounds = dragStartPosRef.current.bounds
        const deltaX = e.clientX - dragStartPosRef.current.mouseX
        const deltaY = e.clientY - dragStartPosRef.current.mouseY
        
        const point1 = map.latLngToContainerPoint([startBounds[0][0], startBounds[0][1]])
        const point2 = map.containerPointToLatLng([point1.x + deltaX, point1.y + deltaY])
        
        const deltaLat = point2.lat - startBounds[0][0]
        const deltaLng = point2.lng - startBounds[0][1]
        
        const newBounds = [
          [startBounds[0][0] + deltaLat, startBounds[0][1] + deltaLng],
          [startBounds[1][0] + deltaLat, startBounds[1][1] + deltaLng]
        ]
        
        commitBoundsChange(newBounds)
        
        isDraggingImageRef.current = false
        dragStartPosRef.current = null
        imageElement.style.cursor = 'move'
        
        e.preventDefault()
        e.stopPropagation()
      }

      imageElement.addEventListener('mousedown', onMouseDown)
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      
      // Store cleanup functions
      return () => {
        imageElement.removeEventListener('mousedown', onMouseDown)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
    }

    // Set up image dragging after a short delay to ensure overlay is rendered
    const cleanupImageDragging = setupImageDragging()

    return () => {
      if (cleanupImageDragging) {
        cleanupImageDragging()
      }
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
