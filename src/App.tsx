import React from 'react'
import { useRoute } from './router'
import NavBar from './components/NavBar'
import LocalPlayer from './pages/LocalPlayer'
import WatchPage from './pages/WatchPage'
import CommunityPage from './pages/CommunityPage'
import PricingPage from './pages/PricingPage'

const App: React.FC = () => {
  const route = useRoute()
  return (
    <>
      <NavBar current={route.name} />
      <div className="page">
        {route.name === 'local' && <LocalPlayer />}
        {route.name === 'watch' && <WatchPage params={route.params} />}
        {route.name === 'community' && <CommunityPage />}
        {route.name === 'pricing' && <PricingPage />}
      </div>
    </>
  )
}

export default App
