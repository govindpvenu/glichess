import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const apiTarget = "http://localhost:3000"

/** Dependencies grouped into chunks by how often they change, so a deploy of app code alone
 * leaves them cached. Chess libraries are used only by the lazily loaded game page. */
const vendorChunks: [name: string, packages: string[]][] = [
  ["react", ["react", "react-dom", "scheduler"]],
  ["router", ["react-router"]],
  ["realtime", ["socket.io-client", "engine.io-client", "socket.io-parser", "@socket.io"]],
  ["auth", ["better-auth", "@better-auth", "@better-fetch", "better-call", "nanostores"]],
  ["chess", ["chess.js", "react-chessboard", "@dnd-kit"]],
]

const nodeModule = (packages: string[]) =>
  new RegExp(`node_modules[\\\\/](${packages.join("|")})[\\\\/]`)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            ...vendorChunks.map(([name, packages]) => ({
              name,
              test: nodeModule(packages),
              priority: 2,
            })),
            // Everything else from npm (Radix, icons, toasts…) shares one chunk.
            { name: "vendor", test: /node_modules/, priority: 1 },
          ],
        },
      },
    },
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
