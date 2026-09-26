import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Extra hosts, such as a Tailscale name, come from DASHBOARD_ALLOWED_HOSTS in the
  // git-ignored .env.local so machine names stay out of the repository.
  const env = loadEnv(mode, process.cwd(), 'DASHBOARD_')
  const allowedHosts = (env.DASHBOARD_ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim()).filter(Boolean)

  return {
    plugins: [react()],
    server: {
      allowedHosts,
      strictPort: true,
      proxy: {
        '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
      },
    },
  }
})
