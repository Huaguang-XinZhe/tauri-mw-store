import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
  minify: true,
  treeshake: true,
  target: "es2020",
  external: ["react", "@tauri-apps/api", "@tauri-apps/plugin-store"],
});
