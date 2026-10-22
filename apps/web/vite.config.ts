import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const apiTarget = "http://localhost:3000"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    // Proxy keeps dev same-origin, matching production where Express serves the app.
    proxy: {
      "/api": { target: apiTarget },
      "/socket.io": { target: apiTarget, ws: true },
    },
  },
})
