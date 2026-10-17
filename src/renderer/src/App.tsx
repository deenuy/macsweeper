import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Dashboard from './components/Dashboard'
import JunkCleaner from './components/JunkCleaner'
import DuplicateFinder from './components/DuplicateFinder'
import SpaceLens from './components/SpaceLens'
import CloudCleanup from './components/CloudCleanup'
import UpdateBanner from './components/UpdateBanner'
import type { DiskStats } from '../../shared/types'

export type Page = 'dashboard' | 'junk' | 'duplicates' | 'space-lens' | 'cloud'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [diskStats, setDiskStats] = useState<DiskStats | null>(null)

  useEffect(() => {
    window.electron.getDiskStats().then(setDiskStats).catch(console.error)
  }, [])

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard diskStats={diskStats} onNavigate={setPage} />
      case 'junk': return <JunkCleaner />
      case 'duplicates': return <DuplicateFinder />
      case 'space-lens': return <SpaceLens />
      case 'cloud': return <CloudCleanup />
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(135deg, #0d0d1a 0%, #12122a 50%, #0a0a1f 100%)',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      <UpdateBanner />
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar current={page} onNavigate={setPage} diskStats={diskStats} />
        <main style={{
          flex: 1,
          overflow: 'hidden auto',
          padding: '28px 32px',
          position: 'relative'
        }}>
          <div className="animate-fade-in" key={page}>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  )
}
