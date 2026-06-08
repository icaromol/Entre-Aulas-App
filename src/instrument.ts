import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom'

Sentry.init({
  dsn: 'https://3505589dc5ef8e4c50abb02eb72c0890@o4511532107235328.ingest.de.sentry.io/4511532111560784',
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
  tracePropagationTargets: ['localhost', /^https:\/\/estudamus\.vercel\.app/],

  sendDefaultPii: false,
})
