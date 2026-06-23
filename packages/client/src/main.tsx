import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AppConfigProvider } from './context/AppConfig.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppConfigProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppConfigProvider>
  </StrictMode>,
)
