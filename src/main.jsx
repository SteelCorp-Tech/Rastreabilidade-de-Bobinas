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
import './styles/print.css'
import Layout from './ui/app/Layout.jsx'
import Home from './ui/app/Home.jsx'
import ModulePage from './ui/app/ModulePage.jsx'
import { ProfileProvider } from './ui/app/ProfileContext.jsx'
import { StoreProvider } from './ui/app/StoreContext.jsx'
import SettingsPage from './ui/app/SettingsPage.jsx'
import RegistryPage from './ui/pages/RegistryPage.jsx'
import MotherCoilsPage from './ui/pages/MotherCoilsPage.jsx'
import MotherCoilForm from './ui/pages/MotherCoilForm.jsx'
import MotherCoilDetail from './ui/pages/MotherCoilDetail.jsx'
import CuttingPlansPage from './ui/pages/CuttingPlansPage.jsx'
import CuttingPlanEditor from './ui/pages/CuttingPlanEditor.jsx'
import { MODULES } from './ui/app/modules.js'

const PAGES = { settings: <SettingsPage />, registry: <RegistryPage />, motherCoils: <MotherCoilsPage />, cuttingPlans: <CuttingPlansPage /> }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProfileProvider>
      <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            {MODULES.filter((m) => m.view !== 'home').map((m) => (
              <Route key={m.path} path={m.path} element={PAGES[m.view] ?? <ModulePage module={m} />} />
            ))}
            <Route path="/bobinas-mae/nova" element={<MotherCoilForm />} />
            <Route path="/bobinas-mae/:id" element={<MotherCoilDetail />} />
            <Route path="/planos-de-corte/:id" element={<CuttingPlanEditor />} />
          </Route>
        </Routes>
      </HashRouter>
      </StoreProvider>
    </ProfileProvider>
  </StrictMode>,
)
