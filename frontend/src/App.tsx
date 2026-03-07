import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CatProfile from './pages/CatProfile'
import AddEditCat from './pages/AddEditCat'
import CompareChart from './pages/CompareChart'
import ImportPage from './pages/ImportPage'
import WellnessGuide from './pages/WellnessGuide'
import PageShell from './components/PageShell'

export default function App() {
  return (
    <BrowserRouter>
      <PageShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/compare" element={<CompareChart />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/wellness" element={<WellnessGuide />} />
          <Route path="/cats/new" element={<AddEditCat />} />
          <Route path="/cats/:id" element={<CatProfile />} />
          <Route path="/cats/:id/edit" element={<AddEditCat />} />
        </Routes>
      </PageShell>
    </BrowserRouter>
  )
}
