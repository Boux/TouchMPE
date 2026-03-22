import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'

const httpsConfig = fs.existsSync('.cert/key.pem')
  ? { key: fs.readFileSync('.cert/key.pem'), cert: fs.readFileSync('.cert/cert.pem') }
  : undefined

export default defineConfig({
  plugins: [vue()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    https: httpsConfig
  }
})
