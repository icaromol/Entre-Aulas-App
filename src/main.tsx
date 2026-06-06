import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import { Router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
    <Toaster position="bottom-center" richColors />
  </StrictMode>,
)