import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy: the browser talks to :5173 only, so no CORS setup is needed locally.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' } },
})
