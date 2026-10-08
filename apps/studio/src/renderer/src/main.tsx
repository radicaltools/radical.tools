// First: document persistence configures the store before it is created.
import './persistence/autosave'
import './persistence/selection'
import './persistence/changeFlash'
import './ai/wireframeGenerator'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@radical/ui/styles.css'
import './studio.css'
import 'reactflow/dist/style.css'
import { ErrorBoundary } from '@radical/ui/components/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
