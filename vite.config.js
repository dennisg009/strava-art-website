import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages: if your repo is named 'strava-art-website', the base should be '/strava-art-website/'
// If your repo is named 'username.github.io' or you're using a custom domain, use '/'
// Update the base path below to match your repository name
export default defineConfig({
  plugins: [react()],
  base: '/',
})

