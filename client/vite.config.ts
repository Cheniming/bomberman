import { defineConfig } from "vite";
import pkg from "../package.json" with { type: "json" };

export default defineConfig({
  base: "./", // 相對路徑，GitHub Pages 子路徑也能用
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { fs: { allow: [".."] } },
});
