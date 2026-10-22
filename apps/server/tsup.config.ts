import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  // Workspace packages ship TypeScript source, so they are bundled into the
  // server output. Their third-party dependencies stay external.
  noExternal: [/^@glichess\//],
})
