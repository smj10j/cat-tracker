import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import CatProfile from './pages/CatProfile'
import AddEditCat from './pages/AddEditCat'
import CompareChart from './pages/CompareChart'
import ImportPage from './pages/ImportPage'
import WellnessGuide from './pages/WellnessGuide'
import CatHealthGuidance from './pages/CatHealthGuidance'
import CatExportPage from './pages/CatExportPage'
import LoginPage from './pages/LoginPage'
import NotificationsPage from './pages/NotificationsPage'
import MedicationFormPage from './pages/MedicationFormPage'
import HouseholdPage from './pages/HouseholdPage'
import InvitePage from './pages/InvitePage'
import DailyCheckin from './pages/DailyCheckin'
import SettingsPage from './pages/SettingsPage'
import MemorialPage from './pages/MemorialPage'
import PrivacyPage from './pages/PrivacyPage'
import PageShell from './components/PageShell'
import ScrollToTop from './components/ScrollToTop'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <PageShell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/compare" element={<CompareChart />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/wellness" element={<WellnessGuide />} />
                  <Route path="/cats/new" element={<AddEditCat />} />
                  <Route path="/cats/:id" element={<CatProfile />} />
                  <Route path="/cats/:id/health" element={<CatHealthGuidance />} />
                  <Route path="/cats/:id/export" element={<CatExportPage />} />
                  <Route path="/cats/:id/edit" element={<AddEditCat />} />
                  <Route path="/cats/:id/memorial" element={<MemorialPage />} />
                  <Route path="/cats/:catId/medications/new" element={<MedicationFormPage />} />
                  <Route path="/medications/:medId/edit" element={<MedicationFormPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/household" element={<HouseholdPage />} />
                  <Route path="/checkin" element={<DailyCheckin />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </PageShell>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
