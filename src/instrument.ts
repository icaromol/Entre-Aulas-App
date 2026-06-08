import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,

  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],

  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
  tracePropagationTargets: ['localhost', /^https:\/\/entre-aulas-app\.vercel\.app/],

  sendDefaultPii: false,
})
