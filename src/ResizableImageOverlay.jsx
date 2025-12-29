import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

function ResizableImageOverlay({ url, bounds, opacity, aspectRatio, onBoundsChange }) {
  const map = useMap()
  const overlayRef = useRef(null)
  const markersRef = useRef([])
  const groupRef = useRef(null)
  const currentBoundsRef = useRef(bounds)

  // Keep currentBoundsRef in sync
  useEffect(() => {
    currentBoundsRef.current = bounds
  }, [bounds])

  useEffect(() => {
    if (!bounds || !map || !url) return

    // Clean up previous overlay and markers
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current)
    }
    if (groupRef.current) {
      groupRef.current.clearLayers()
      map.removeLayer(groupRef.current)
    }
    
    // Create native Leaflet ImageOverlay for direct manipulation
    const leafletBounds = L.latLngBounds(bounds[0], bounds[1])
    const imageOverlay = L.imageOverlay(url, leafletBounds, {
      opacity: opacity,
      interactive: true,
      zIndex: 500
    }).addTo(map)
    
    overlayRef.current = imageOverlay
    
    // Make image draggable
    const imageElement = imageOverlay.getElement()
    if (imageElement) {
      imageElement.style.cursor = 'move'
    }
    
    // Create a new layer group for all markers
    groupRef.current = L.layerGroup().addTo(map)
    markersRef.current = []

    const centerLat = (bounds[0][0] + bounds[1][0]) / 2
    const centerLng = (bounds[0][1] + bounds[1][1]) / 2

    // Update overlay bounds directly for real-time visual feedback
    const updateOverlayBoundsVisually = (newBounds) => {
      if (overlayRef.current) {
        const leafletBounds = L.latLngBounds(newBounds[0], newBounds[1])
        overlayRef.current.setBounds(leafletBounds)
        currentBoundsRef.current = newBounds
      }
    }

    // Commit bounds change to React state
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
      markersRef.current[1].setLatLng([newBounds[0][0], newBounds[1][1]]) // SE
      markersRef.current[2].setLatLng([newBounds[1][0], newBounds[1][1]]) // NE
      markersRef.current[3].setLatLng([newBounds[1][0], newBounds[0][1]]) // NW
      
      // Update edge markers
      markersRef.current[4].setLatLng([newCenterLat, newBounds[0][1]]) // West
      markersRef.current[5].setLatLng([newCenterLat, newBounds[1][1]]) // East
      markersRef.current[6].setLatLng([newBounds[0][0], newCenterLng]) // South
      markersRef.current[7].setLatLng([newBounds[1][0], newCenterLng]) // North
      
      // Update center marker
      markersRef.current[8].setLatLng([newCenterLat, newCenterLng])
    }

    // Setup image dragging (click and drag anywhere on the image)
    let isDraggingImage = false
    let dragStartPos = null

    const onImageMouseDown = (e) => {
      // Check if clicking on a handle
      const target = e.originalEvent?.target || e.target
      if (target.classList?.contains('resize-handle-corner') || 
          target.classList?.contains('resize-handle-edge') ||
          target.classList?.contains('drag-handle')) {
        return
      }
      
      isDraggingImage = true
      dragStartPos = {
        latlng: e.latlng,
        bounds: [...currentBoundsRef.current]
      }
      
      if (imageElement) {
        imageElement.style.cursor = 'grabbing'
      }
      
      // Disable map dragging while dragging image
      map.dragging.disable()
      
      L.DomEvent.stop(e)
    }

    const onMouseMove = (e) => {
      if (!isDraggingImage || !dragStartPos) return
      
      const startBounds = dragStartPos.bounds
      const deltaLat = e.latlng.lat - dragStartPos.latlng.lat
      const deltaLng = e.latlng.lng - dragStartPos.latlng.lng
      
      const newBounds = [
        [startBounds[0][0] + deltaLat, startBounds[0][1] + deltaLng],
        [startBounds[1][0] + deltaLat, startBounds[1][1] + deltaLng]
      ]
      
      updateOverlayBoundsVisually(newBounds)
      updateMarkerPositions(newBounds)
    }

    const onMouseUp = (e) => {
      if (!isDraggingImage) return
      
      // Re-enable map dragging
      map.dragging.enable()
      
      if (imageElement) {
        imageElement.style.cursor = 'move'
      }
      
      if (dragStartPos) {
        const startBounds = dragStartPos.bounds
        const deltaLat = e.latlng.lat - dragStartPos.latlng.lat
        const deltaLng = e.latlng.lng - dragStartPos.latlng.lng
        
        const newBounds = [
          [startBounds[0][0] + deltaLat, startBounds[0][1] + deltaLng],
          [startBounds[1][0] + deltaLat, startBounds[1][1] + deltaLng]
        ]
        
        commitBoundsChange(newBounds)
      }
      
      isDraggingImage = false
      dragStartPos = null
    }

    // Attach events to overlay
    imageOverlay.on('mousedown', onImageMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)

    // Corner handles (diagonal resize - preserve aspect ratio)
    const cornerPositions = [
      [bounds[0][0], bounds[0][1]], // Southwest (index 0)
      [bounds[0][0], bounds[1][1]], // Southeast (index 1)
      [bounds[1][0], bounds[1][1]], // Northeast (index 2)
      [bounds[1][0], bounds[0][1]]  // Northwest (index 3)
    ]

    const cornerCursors = ['nesw-resize', 'nwse-resize', 'nesw-resize', 'nwse-resize']
    const cornerClasses = ['resize-handle-corner-sw', 'resize-handle-corner-se', 'resize-handle-corner-ne', 'resize-handle-corner-nw']

    cornerPositions.forEach((corner, index) => {
      const icon = L.divIcon({
        className: `resize-handle-corner ${cornerClasses[index]}`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })

      const marker = L.marker(corner, {
        icon,
        draggable: true,
        zIndexOffset: 1000
      })
      
      setTimeout(() => {
        const el = marker.getElement()
        if (el) el.style.cursor = cornerCursors[index]
      }, 0)

      let dragStartBounds = null

      marker.on('dragstart', () => {
        dragStartBounds = [...currentBoundsRef.current]
        map.dragging.disable()
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
          updateOverlayBoundsVisually(newBounds)
          updateMarkerPositions(newBounds)
        }
      })

      marker.on('dragend', () => {
        map.dragging.enable()
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

    // Edge handles (horizontal/vertical stretch)
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
        dragStartBounds = [...currentBoundsRef.current]
        map.dragging.disable()
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
        map.dragging.enable()
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

    let centerDragStartBounds = null

    centerMarker.on('dragstart', () => {
      centerDragStartBounds = [...currentBoundsRef.current]
      map.dragging.disable()
    })

    centerMarker.on('drag', () => {
      if (!centerDragStartBounds) return
      
      const newCenter = centerMarker.getLatLng()
      const startHeight = centerDragStartBounds[1][0] - centerDragStartBounds[0][0]
      const startWidth = centerDragStartBounds[1][1] - centerDragStartBounds[0][1]
      
      const newBounds = [
        [newCenter.lat - startHeight / 2, newCenter.lng - startWidth / 2],
        [newCenter.lat + startHeight / 2, newCenter.lng + startWidth / 2]
      ]
      updateOverlayBoundsVisually(newBounds)
      updateMarkerPositions(newBounds)
    })

    centerMarker.on('dragend', () => {
      map.dragging.enable()
      if (!centerDragStartBounds) return
      
      const newCenter = centerMarker.getLatLng()
      const startHeight = centerDragStartBounds[1][0] - centerDragStartBounds[0][0]
      const startWidth = centerDragStartBounds[1][1] - centerDragStartBounds[0][1]
      
      const newBounds = [
        [newCenter.lat - startHeight / 2, newCenter.lng - startWidth / 2],
        [newCenter.lat + startHeight / 2, newCenter.lng + startWidth / 2]
      ]
      commitBoundsChange(newBounds)
      centerDragStartBounds = null
    })

    centerMarker.addTo(groupRef.current)
    markersRef.current.push(centerMarker)

    return () => {
      // Clean up event listeners
      imageOverlay.off('mousedown', onImageMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current)
        overlayRef.current = null
      }
      if (groupRef.current) {
        groupRef.current.clearLayers()
        map.removeLayer(groupRef.current)
        groupRef.current = null
      }
      markersRef.current = []
    }
  }, [url, map, onBoundsChange, aspectRatio])

  // Update opacity when it changes
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setOpacity(opacity)
    }
  }, [opacity])

  return null // We're managing the overlay directly with Leaflet, not React
}

export default ResizableImageOverlay
