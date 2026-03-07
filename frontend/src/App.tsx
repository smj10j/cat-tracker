import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CatProfile from './pages/CatProfile'
import AddEditCat from './pages/AddEditCat'
import CompareChart from './pages/CompareChart'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compare" element={<CompareChart />} />
        <Route path="/cats/new" element={<AddEditCat />} />
        <Route path="/cats/:id" element={<CatProfile />} />
        <Route path="/cats/:id/edit" element={<AddEditCat />} />
      </Routes>
    </BrowserRouter>
  )
}
