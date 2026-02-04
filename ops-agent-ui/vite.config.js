import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // 适配 NC 框架：将基础路径设置为 /ops-agent-ui/，确保静态资源在 Nginx 子路径下能正确加载
  base: '/ops-agent-ui/',
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/captcha': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/token': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/register': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/guest-token': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/get_answer': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true, timeout: 60000, proxyTimeout: 60000 },
      '/upload_doc': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/hot_questions': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/feedback': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/reprocess_docs': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/pending_docs': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/approve_doc': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/reject_doc': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/download_doc': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/download_source': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/documents': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/api': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/admin': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/user_images': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/debug': { target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
    }
  }
})
