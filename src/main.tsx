import './instrument'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import Clarity from '@microsoft/clarity'
import { reactErrorHandler } from '@sentry/react'
import './index.css'
import { Router } from './router'
import { AuthProvider } from './hooks/useAuth'

Clarity.init('x4109xdyb0')

createRoot(document.getElementById('root')!, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <StrictMode>
    <AuthProvider>
      <Router />
      <Toaster position="bottom-center" richColors />
    </AuthProvider>
  </StrictMode>,
)