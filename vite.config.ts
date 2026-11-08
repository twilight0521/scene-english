import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: { "/v1": `http://127.0.0.1:${env.PORT || 3001}` },
    },
    build: { outDir: "dist" },
  };
});
