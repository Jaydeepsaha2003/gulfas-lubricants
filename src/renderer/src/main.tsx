import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import App from './App'
import { Toaster } from '@/components/ui/sonner'
import './assets/globals.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster richColors closeButton position="top-right" />
    </HashRouter>
  </React.StrictMode>
)
