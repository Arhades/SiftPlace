import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installCrashReporter } from './lib/telemetry'

// auto-report uncaught crashes to the admin (no-op until Supabase env is set)
installCrashReporter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
