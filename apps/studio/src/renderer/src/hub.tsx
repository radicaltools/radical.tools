import React from 'react'
import ReactDOM from 'react-dom/client'
import HubApp from './hub/HubApp'
import './index.css'
import './hub/hub.css'
import 'reactflow/dist/style.css'
import { ErrorBoundary } from './components/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HubApp />
    </ErrorBoundary>
  </React.StrictMode>
)
