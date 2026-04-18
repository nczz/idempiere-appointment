import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../com.mxp.idempiere.appointments/web/appointments',
    emptyOutDir: true,
  },
})
