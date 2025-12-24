// Initialize map
let map = L.map('map').setView([40.7128, -74.0060], 13); // Default to NYC
let routes = [];
let currentRouteLayer = null;

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Initialize map after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
});

function initializeMap() {
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                map.setView([position.coords.latitude, position.coords.longitude], 13);
                L.marker([position.coords.latitude, position.coords.longitude])
                    .addTo(map)
                    .bindPopup('Your Location')
                    .openPopup();
            },
            function(error) {
                console.log('Geolocation error:', error);
            }
        );
    }
}

function setupEventListeners() {
    // Location search
    document.getElementById('search-btn').addEventListener('click', searchLocation);
    document.getElementById('location-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchLocation();
    });

    // Center on location
    document.getElementById('center-location-btn').addEventListener('click', centerOnLocation);

    // GPX file upload
    const gpxUploadArea = document.getElementById('gpx-upload-area');
    const gpxFileInput = document.getElementById('gpx-file-input');
    
    gpxUploadArea.addEventListener('click', () => gpxFileInput.click());
    gpxFileInput.addEventListener('change', handleGPXFile);
    setupDragAndDrop(gpxUploadArea, handleGPXFile);

    // Image file upload
    const imageUploadArea = document.getElementById('image-upload-area');
    const imageFileInput = document.getElementById('image-file-input');
    
    imageUploadArea.addEventListener('click', () => imageFileInput.click());
    imageFileInput.addEventListener('change', handleImageFile);
    setupDragAndDrop(imageUploadArea, handleImageFile);

    // Route generation
    document.getElementById('generate-route-btn').addEventListener('click', generateRouteFromText);

    // Clear and export
    document.getElementById('clear-routes-btn').addEventListener('click', clearAllRoutes);
    document.getElementById('export-gpx-btn').addEventListener('click', exportGPX);
}

function setupDragAndDrop(element, handler) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('dragover');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('dragover');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handler({ target: { files: files } });
        }
    });
}

async function searchLocation() {
    const query = document.getElementById('location-search').value.trim();
    if (!query) {
        showNotification('Please enter a location', 'error');
        return;
    }

    try {
        showNotification('Searching location...', 'info');
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const data = await response.json();

        if (data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            map.setView([lat, lon], 13);
            L.marker([lat, lon]).addTo(map).bindPopup(result.display_name).openPopup();
            showNotification('Location found!', 'success');
        } else {
            showNotification('Location not found', 'error');
        }
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Error searching location', 'error');
    }
}

function centerOnLocation() {
    if (navigator.geolocation) {
        showNotification('Getting your location...', 'info');
        navigator.geolocation.getCurrentPosition(
            function(position) {
                map.setView([position.coords.latitude, position.coords.longitude], 13);
                L.marker([position.coords.latitude, position.coords.longitude])
                    .addTo(map)
                    .bindPopup('Your Location')
                    .openPopup();
                showNotification('Centered on your location!', 'success');
            },
            function(error) {
                showNotification('Could not get your location', 'error');
            }
        );
    } else {
        showNotification('Geolocation not supported', 'error');
    }
}

function handleGPXFile(event) {
    const file = event.target.files[0] || (event.dataTransfer && event.dataTransfer.files[0]);
    if (!file) return;

    if (!file.name.endsWith('.gpx')) {
        showNotification('Please upload a GPX file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const gpxContent = e.target.result;
            parseGPX(gpxContent);
            showNotification('GPX file loaded successfully!', 'success');
        } catch (error) {
            console.error('GPX parsing error:', error);
            showNotification('Error parsing GPX file', 'error');
        }
    };
    reader.readAsText(file);
}

function parseGPX(gpxContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    
    if (trackPoints.length === 0) {
        showNotification('No track points found in GPX file', 'error');
        return;
    }

    const coordinates = [];
    trackPoints.forEach(point => {
        const lat = parseFloat(point.getAttribute('lat'));
        const lon = parseFloat(point.getAttribute('lon'));
        if (!isNaN(lat) && !isNaN(lon)) {
            coordinates.push([lat, lon]);
        }
    });

    if (coordinates.length > 0) {
        displayRoute(coordinates);
    }
}

function handleImageFile(event) {
    const file = event.target.files[0] || (event.dataTransfer && event.dataTransfer.files[0]);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showNotification('Please upload an image file', 'error');
        return;
    }

    showNotification('Processing image...', 'info');
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            try {
                const route = imageToRoute(img);
                if (route && route.length > 0) {
                    displayRoute(route);
                    showNotification('Route generated from image!', 'success');
                } else {
                    showNotification('Could not generate route from image', 'error');
                }
            } catch (error) {
                console.error('Image processing error:', error);
                showNotification('Error processing image', 'error');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function imageToRoute(img) {
    // Get current map bounds
    const bounds = map.getBounds();
    const center = bounds.getCenter();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;

    // Create canvas to process image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const maxSize = 150; // Process at moderate resolution for better quality
    const scale = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Convert to grayscale and apply edge detection
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const grayscale = new Uint8Array(canvas.width * canvas.height);
    
    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        grayscale[i / 4] = (r + g + b) / 3;
    }

    // Find threshold (use median or adaptive threshold)
    const sorted = Array.from(grayscale).sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.3)]; // Use 30th percentile

    // Extract edge points using contour following
    const route = [];
    const visited = new Set();
    const step = 1; // Sample every pixel for better quality

    // Find starting point (first dark pixel)
    let startX = -1, startY = -1;
    for (let y = 0; y < canvas.height && startX === -1; y++) {
        for (let x = 0; x < canvas.width; x++) {
            if (grayscale[y * canvas.width + x] < threshold) {
                startX = x;
                startY = y;
                break;
            }
        }
    }

    if (startX === -1) {
        // If no dark pixels, return empty route
        return [];
    }

    // Follow contour using simple edge following
    let x = startX, y = startY;
    const directions = [
        [1, 0], [1, 1], [0, 1], [-1, 1],
        [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];

    let maxPoints = 2000; // Limit points for performance
    let pointCount = 0;

    while (pointCount < maxPoints) {
        const key = `${x},${y}`;
        if (!visited.has(key) && x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            if (grayscale[y * canvas.width + x] < threshold) {
                // Map image coordinates to map coordinates
                const lat = center.lat + (y / canvas.height - 0.5) * latRange;
                const lng = center.lng + (x / canvas.width - 0.5) * lngRange;
                route.push([lat, lng]);
                visited.add(key);
                pointCount++;
            }
        }

        // Move to next point (simple spiral search)
        const angle = (pointCount / maxPoints) * Math.PI * 8;
        const radius = Math.sqrt(pointCount) * 0.5;
        x = Math.floor(startX + radius * Math.cos(angle));
        y = Math.floor(startY + radius * Math.sin(angle));

        if (pointCount > 100 && route.length < 10) {
            // Fallback: sample dark pixels
            break;
        }
    }

    // If contour following didn't work well, fall back to sampling
    if (route.length < 50) {
        route.length = 0; // Clear route
        for (let y = 0; y < canvas.height; y += 2) {
            for (let x = 0; x < canvas.width; x += 2) {
                if (grayscale[y * canvas.width + x] < threshold) {
                    const lat = center.lat + (y / canvas.height - 0.5) * latRange;
                    const lng = center.lng + (x / canvas.width - 0.5) * lngRange;
                    route.push([lat, lng]);
                }
            }
        }
    }

    // Optimize route: connect nearby points
    return optimizeRoute(route);
}

function optimizeRoute(points) {
    if (points.length < 2) return points;

    // Simple optimization: connect points in order, skipping very close ones
    const optimized = [points[0]];
    const minDistance = 0.0001; // Minimum distance between points

    for (let i = 1; i < points.length; i++) {
        const lastPoint = optimized[optimized.length - 1];
        const currentPoint = points[i];
        
        const distance = Math.sqrt(
            Math.pow(currentPoint[0] - lastPoint[0], 2) +
            Math.pow(currentPoint[1] - lastPoint[1], 2)
        );

        if (distance > minDistance) {
            optimized.push(currentPoint);
        }
    }

    return optimized;
}

async function generateRouteFromText() {
    const text = document.getElementById('route-search').value.trim();
    const distance = parseFloat(document.getElementById('route-distance').value);

    if (!text) {
        showNotification('Please enter text to generate route', 'error');
        return;
    }

    if (!distance || distance <= 0) {
        showNotification('Please enter a valid distance', 'error');
        return;
    }

    showNotification('Generating route... This may take a moment.', 'info');

    try {
        const center = map.getCenter();
        const route = await generateTextRoute(text, distance, center);
        
        if (route && route.length > 0) {
            displayRoute(route);
            showNotification(`Route generated for "${text}"!`, 'success');
        } else {
            showNotification('Could not generate route. Try a different term.', 'error');
        }
    } catch (error) {
        console.error('Route generation error:', error);
        showNotification('Error generating route', 'error');
    }
}

async function generateTextRoute(text, distanceKm, center) {
    const pattern = text.toLowerCase();
    const route = [];
    const steps = Math.max(100, Math.floor(distanceKm * 15)); // Points per km
    const baseRadius = distanceKm / 111; // Approximate km to degrees

    if (pattern.includes('heart') || pattern.includes('love')) {
        // Heart shape parametric equation
        for (let i = 0; i < steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
            const scale = baseRadius / 20;
            route.push([
                center.lat + y * scale,
                center.lng + x * scale
            ]);
        }
    } else if (pattern.includes('star')) {
        // Star shape (5-pointed)
        const points = 5;
        for (let i = 0; i < steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            let r = baseRadius;
            if (Math.abs(t % (Math.PI * 2 / points) - Math.PI / points) < 0.3) {
                r = baseRadius * 0.4; // Inner points
            }
            route.push([
                center.lat + r * Math.cos(t),
                center.lng + r * Math.sin(t)
            ]);
        }
    } else if (pattern.includes('circle') || pattern.includes('round')) {
        // Perfect circle
        for (let i = 0; i < steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            route.push([
                center.lat + baseRadius * Math.cos(t),
                center.lng + baseRadius * Math.sin(t)
            ]);
        }
    } else if (pattern.includes('square') || pattern.includes('box')) {
        // Square shape
        const side = baseRadius * 1.4;
        const corners = [
            [center.lat + side, center.lng + side],
            [center.lat + side, center.lng - side],
            [center.lat - side, center.lng - side],
            [center.lat - side, center.lng + side]
        ];
        for (let i = 0; i < steps; i++) {
            const cornerIndex = Math.floor((i / steps) * 4);
            const nextCornerIndex = (cornerIndex + 1) % 4;
            const progress = (i / steps * 4) % 1;
            const lat = corners[cornerIndex][0] * (1 - progress) + corners[nextCornerIndex][0] * progress;
            const lng = corners[cornerIndex][1] * (1 - progress) + corners[nextCornerIndex][1] * progress;
            route.push([lat, lng]);
        }
    } else if (pattern.includes('spiral')) {
        // Spiral pattern
        for (let i = 0; i < steps; i++) {
            const t = (i / steps) * Math.PI * 8; // Multiple rotations
            const r = baseRadius * (i / steps);
            route.push([
                center.lat + r * Math.cos(t),
                center.lng + r * Math.sin(t)
            ]);
        }
    } else if (pattern.includes('bunny') || pattern.includes('rabbit')) {
        // Bunny/rabbit shape (simplified)
        for (let i = 0; i < steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            let r = baseRadius;
            // Create bunny-like shape with ears
            if (t > Math.PI * 0.2 && t < Math.PI * 0.4) {
                r = baseRadius * 1.3; // Left ear
            } else if (t > Math.PI * 1.6 && t < Math.PI * 1.8) {
                r = baseRadius * 1.3; // Right ear
            } else if (t > Math.PI * 0.7 && t < Math.PI * 1.3) {
                r = baseRadius * 0.9; // Body
            }
            route.push([
                center.lat + r * Math.cos(t),
                center.lng + r * Math.sin(t)
            ]);
        }
    } else {
        // Default: create a pattern based on text characters
        // Use character codes to create unique patterns
        let angle = 0;
        const angleStep = (Math.PI * 2) / steps;
        
        for (let i = 0; i < steps; i++) {
            const charIndex = i % pattern.length;
            const charCode = pattern.charCodeAt(charIndex);
            const variation = Math.sin(charCode) * 0.3;
            
            // Create a varied spiral pattern
            const r = baseRadius * (0.3 + (i / steps) * 0.7) * (1 + variation);
            route.push([
                center.lat + r * Math.cos(angle),
                center.lng + r * Math.sin(angle)
            ]);
            angle += angleStep;
        }
    }

    return route;
}

function displayRoute(coordinates) {
    // Remove previous route if exists
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
    }

    // Create polyline
    const polyline = L.polyline(coordinates, {
        color: '#667eea',
        weight: 4,
        opacity: 0.8
    }).addTo(map);

    // Fit map to route bounds
    const bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, { padding: [50, 50] });

    // Store route
    currentRouteLayer = polyline;
    routes.push({
        coordinates: coordinates,
        layer: polyline
    });
}

function clearAllRoutes() {
    routes.forEach(route => {
        map.removeLayer(route.layer);
    });
    routes = [];
    currentRouteLayer = null;
    showNotification('All routes cleared', 'success');
}

function exportGPX() {
    if (routes.length === 0) {
        showNotification('No routes to export', 'error');
        return;
    }

    // Combine all routes or use the last one
    const routeToExport = routes[routes.length - 1].coordinates;
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava Art Creator">
  <trk>
    <name>Strava Art Route</name>
    <trkseg>
`;

    routeToExport.forEach(coord => {
        gpx += `      <trkpt lat="${coord[0]}" lon="${coord[1]}"></trkpt>\n`;
    });

    gpx += `    </trkseg>
  </trk>
</gpx>`;

    // Download file
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strava-art-route.gpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('GPX file exported!', 'success');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

