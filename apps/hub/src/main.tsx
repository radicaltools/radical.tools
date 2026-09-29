import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@radical/ui/viewer'
import HubApp from './HubApp'
import '@radical/ui/styles.css'
import './hub.css'
import 'reactflow/dist/style.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HubApp />
    </ErrorBoundary>
  </React.StrictMode>
)
