import { Routes, Route } from 'react-router'
import CreatePage from './pages/CreatePage'
import PastePage from './pages/PastePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CreatePage />} />
      <Route path="/:pasteId" element={<PastePage />} />
    </Routes>
  )
}

export default App
