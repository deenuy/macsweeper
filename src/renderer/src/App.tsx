import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Dashboard from './components/Dashboard'
import JunkCleaner from './components/JunkCleaner'
import DuplicateFinder from './components/DuplicateFinder'
import SpaceLens from './components/SpaceLens'
import CloudCleanup from './components/CloudCleanup'
import MailCleaner from './components/MailCleaner'
import UpdateBanner from './components/UpdateBanner'
import type { DiskStats } from '../../shared/types'

export type Page = 'dashboard' | 'junk' | 'duplicates' | 'space-lens' | 'cloud' | 'mail'

export interface PageTheme {
  gradient: string
  accent: string
  navSelected: string
  glow: string
}

export const PAGE_THEMES: Record<Page, PageTheme> = {
  dashboard: {
    gradient: 'radial-gradient(ellipse at 18% 65%, #9B3DC8 0%, #5E1A8A 32%, #220B3A 65%, #0D0418 100%)',
    accent: '#CF6EE4',
    navSelected: 'rgba(155, 61, 200, 0.55)',
    glow: 'rgba(180, 80, 220, 0.5)'
  },
  junk: {
    gradient: 'radial-gradient(ellipse at 18% 65%, #8A2A9E 0%, #521070 32%, #1C0828 65%, #0A0318 100%)',
    accent: '#C060D8',
    navSelected: 'rgba(138, 42, 158, 0.55)',
    glow: 'rgba(160, 60, 200, 0.5)'
  },
  duplicates: {
    gradient: 'radial-gradient(ellipse at 18% 65%, #6B32A8 0%, #3D1878 32%, #120826 65%, #060316 100%)',
    accent: '#9B7EE4',
    navSelected: 'rgba(107, 50, 168, 0.55)',
    glow: 'rgba(140, 90, 210, 0.5)'
  },
  'space-lens': {
    gradient: 'radial-gradient(ellipse at 18% 65%, #6B3DC8 0%, #3A1882 32%, #130828 65%, #070214 100%)',
    accent: '#9B5CE8',
    navSelected: 'rgba(107, 61, 200, 0.55)',
    glow: 'rgba(140, 80, 220, 0.5)'
  },
  cloud: {
    gradient: 'radial-gradient(ellipse at 18% 65%, #18507A 0%, #0A2848 32%, #030C1A 65%, #020810 100%)',
    accent: '#4A90CF',
    navSelected: 'rgba(24, 80, 122, 0.55)',
    glow: 'rgba(50, 100, 170, 0.5)'
  },
  mail: {
    gradient: 'radial-gradient(ellipse at 18% 65%, #167A6A 0%, #083D34 32%, #021410 65%, #010A08 100%)',
    accent: '#2EC4B6',
    navSelected: 'rgba(22, 122, 106, 0.55)',
    glow: 'rgba(46, 196, 182, 0.5)'
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [diskStats, setDiskStats] = useState<DiskStats | null>(null)
  const theme = PAGE_THEMES[page]

  useEffect(() => {
    window.electron.getDiskStats().then(setDiskStats).catch(console.error)
  }, [])

  const renderPage = () => {
    switch (page) {
      case 'dashboard':    return <Dashboard diskStats={diskStats} onNavigate={setPage} theme={theme} />
      case 'junk':         return <JunkCleaner theme={theme} />
      case 'duplicates':   return <DuplicateFinder theme={theme} />
      case 'space-lens':   return <SpaceLens />
      case 'cloud':        return <CloudCleanup />
      case 'mail':         return <MailCleaner />
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: theme.gradient,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'background 0.5s ease'
    }}>
      <UpdateBanner />
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar current={page} onNavigate={setPage} diskStats={diskStats} theme={theme} />
        <main style={{
          flex: 1,
          overflow: 'hidden auto',
          padding: '32px 40px 32px 36px',
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
