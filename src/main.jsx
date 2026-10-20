import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/jetbrains-mono/400.css'
import './styles/tokens.css'
import './styles/base.css'
import Layout from './ui/app/Layout.jsx'
import Home from './ui/app/Home.jsx'
import ModulePage from './ui/app/ModulePage.jsx'
import { ProfileProvider } from './ui/app/ProfileContext.jsx'
import { MODULES } from './ui/app/modules.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProfileProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            {MODULES.filter((m) => m.view !== 'home').map((m) => (
              <Route key={m.path} path={m.path} element={<ModulePage module={m} />} />
            ))}
          </Route>
        </Routes>
      </HashRouter>
    </ProfileProvider>
  </StrictMode>,
)
