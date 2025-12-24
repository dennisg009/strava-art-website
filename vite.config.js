import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages: base path must match repository name
export default defineConfig({
  plugins: [react()],
  base: '/strava-art-website/',
})

