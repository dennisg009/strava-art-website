# Strava Art Creator

A React-based web application for creating GPS art routes for Strava activities. Create beautiful route designs by clicking on a map, tracing over images, or drawing custom routes that snap to roads.

## Features

- 🗺️ **Interactive Map**: Powered by React-Leaflet and OpenStreetMap
- 📍 **Location Search**: Search for any location using Nominatim (OpenStreetMap)
- 🖱️ **Click to Draw**: Click on the map to add points and create your route
- 🖼️ **Image Overlay**: Upload a transparent PNG image and overlay it on the map with adjustable opacity for tracing
- 🛣️ **Snap to Roads**: Enable OSRM (Open Source Routing Machine) integration to automatically snap your route to actual streets
- 🗑️ **Edit Points**: Delete the last point or clear all points
- 💾 **GPX Export**: Export your routes as GPX files compatible with Strava

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd strava-art-website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## Usage

### Creating a Route

1. **Click to Add Points**: Simply click anywhere on the map to add points. Points will be connected with lines automatically.

2. **Search for Location**: Use the search bar to quickly navigate to any location. Type an address or location name and click the search button (or press Enter).

3. **Upload Image Overlay**:
   - Upload a transparent PNG image
   - Adjust the opacity slider to make the image more or less visible
   - Trace over the image by clicking points on the map
   - Click "Remove" to remove the image overlay

4. **Snap to Roads**:
   - Enable the "Snap to Roads (OSRM)" checkbox
   - When you click two points, the line will automatically route along actual streets instead of being a straight line
   - This feature uses the OSRM routing service

5. **Edit Your Route**:
   - Click "Delete Last Point" to remove the most recently added point
   - Click "Clear All" to remove all points and start over

6. **Export GPX**:
   - Once you're happy with your route, click "Export GPX"
   - The route will be downloaded as a `.gpx` file
   - Upload this file to Strava or any GPS-compatible application

## Technologies Used

- **React**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React-Leaflet**: React components for Leaflet maps
- **Leaflet.js**: Interactive map library
- **OpenStreetMap**: Map tiles
- **Nominatim**: Geocoding service for location search
- **OSRM**: Open Source Routing Machine for road snapping

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript
- React 18+
- CSS Grid and Flexbox

## License

This project is open source and available for personal use.

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.
