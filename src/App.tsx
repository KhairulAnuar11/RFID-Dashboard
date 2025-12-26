import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RFIDProvider } from './context/RFIDContext';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TagsPage } from './pages/TagsPage';
import { DevicesPage } from './pages/DevicesPage';
import { LocationPage } from './pages/LocationPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { Toaster } from 'sonner';


// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// Main Layout Component
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      {children}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RFIDProvider>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            {/* Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <DashboardPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tags"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <TagsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <DevicesPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/location"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <LocationPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <SettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <HelpPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </RFIDProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;