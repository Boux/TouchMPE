import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
