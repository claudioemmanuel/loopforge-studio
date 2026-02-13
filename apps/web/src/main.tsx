import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

// Pages
import { DashboardPage } from './pages/DashboardPage'
import { RepositoryPage } from './pages/RepositoryPage'
import { TaskFlowPage } from './pages/TaskFlowPage'
import { StageFullPage } from './pages/StageFullPage'
import { SettingsPage } from './pages/SettingsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { LoginPage } from './pages/LoginPage'

// Components
import { AuthGuard } from './components/layout/AuthGuard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TaskRedirect } from './components/routing/TaskRedirect'
import { Toaster } from './components/ui/sonner'
import { useThemeStore } from './store/theme.store'

useThemeStore.getState().init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/repo/:repoId" element={<RepositoryPage />} />
          <Route path="/repo/:repoId/task/:taskId" element={<TaskFlowPage />} />
          <Route path="/repo/:repoId/task/:taskId/stage/:stage" element={<StageFullPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          {/* Backward compat redirect */}
          <Route path="/task/:id" element={<TaskRedirect />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    <Toaster richColors position="top-right" />
    </ErrorBoundary>
  </React.StrictMode>,
)
