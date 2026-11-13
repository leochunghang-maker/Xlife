import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateInlinePhotos } from './lib/photoStore'

// Move any legacy inline photos out of localStorage before the app reads it.
// Bounded so a slow photo store can never block startup; the migration skips
// any key the app changes meanwhile and retries on the next launch.
const migration = migrateInlinePhotos().catch((error) => {
  console.warn('[xlife] photo migration skipped', error)
})
const timeout = new Promise((resolve) => setTimeout(resolve, 4000))

Promise.race([migration, timeout]).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
