import { Route, Routes } from 'react-router-dom'

import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlayerPage } from './pages/PlayerPage'

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<PlayerPage />} />
      <Route path="/lp" element={<LandingPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
