import { useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuthStore } from './stores/auth-store';

import AgentLayout from './pages/AgentLayout';
import SupervisorLayout from './pages/SupervisorLayout';
import Index from './pages/Index';
import AgentHome from './pages/agent/Home';
import AgentNotifications from './pages/agent/Notifications';
import AgentPerformance from './pages/agent/Performance';
import AgentExemplars from './pages/agent/Exemplars';
import SupervisorOverview from './pages/supervisor/Overview';
import SupervisorAlerts from './pages/supervisor/Alerts';
import SupervisorSearch from './pages/supervisor/Search';
import SupervisorBriefs from './pages/supervisor/Briefs';
import SupervisorSettings from './pages/supervisor/Settings';
import { ProtectedRoute } from './components/ProtectedRoute';
import ChatTranscriptViewer from './components/ChatTranscriptViewer';

import './App.css';
import '@aws-amplify/ui-react/styles.css';

// 1. EXTRACT THE INNER APP LOGIC
// This component only renders *after* the user is successfully logged in via the Authenticator.
function AuthenticatedApp() {
  // useAuthenticator gives us access to the user and signOut function safely
  const { user, signOut: amplifySignOut } = useAuthenticator((context) => [context.user]);
  const { signIn, signOut } = useAuthStore();

  // 2. THIS USEEFFECT IS NOW SAFELY AT THE TOP LEVEL OF A COMPONENT
  useEffect(() => {
    async function syncUserRole() {
      if (user) {
        try {
          const session = await fetchAuthSession();
          const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || [];
          
          // Determine role from Cognito groups, default to agent
          const role = groups.includes('supervisor') ? 'supervisor' : 'agent';

          signIn({
            id: user.userId,
            email: user.signInDetails?.loginId || '',
            name: user.username || 'User',
            role: role, 
          });
        } catch (error) {
          console.error("Error fetching user session", error);
        }
      }
    }
    syncUserRole();
  }, [user, signIn]);

  const handleSignOut = () => {
    amplifySignOut();
    signOut(); // Clear local Zustand state
  };

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}>
      <Routes>
        <Route path="/" element={<Index />} />
        
        <Route path="/transcript-test" element={
          <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
            {/* Provide a real path from your bucket here! */}
            <ChatTranscriptViewer s3Key="connect/firsthub/ChatTranscripts/2026/04/07/8194a906-ef39-4e6d-8ccc-a924ed53fc2a_20260407T08:45_UTC.json" />
          </div>
        } />

        <Route path="/agent" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentLayout onSignOut={handleSignOut} />
          </ProtectedRoute>
        }>
          <Route index element={<AgentHome />} />
          <Route path="notifications" element={<AgentNotifications />} />
          <Route path="performance" element={<AgentPerformance />} />
          <Route path="exemplars" element={<AgentExemplars />} />
        </Route>

        <Route path="/supervisor" element={
          <ProtectedRoute allowedRoles={['supervisor']}>
            <SupervisorLayout onSignOut={handleSignOut} />
          </ProtectedRoute>
        }>
          <Route index element={<SupervisorOverview />} />
          <Route path="alerts" element={<SupervisorAlerts />} />
          <Route path="search" element={<SupervisorSearch />} />
          <Route path="briefs" element={<SupervisorBriefs />} />
          <Route path="settings" element={<SupervisorSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// 3. THE MAIN APP WRAPPER
function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      {/* The Authenticator handles the login UI. 
        Once logged in, it renders the AuthenticatedApp children safely.
      */}
      <Authenticator.Provider>
        <Authenticator>
          <AuthenticatedApp />
        </Authenticator>
      </Authenticator.Provider>
    </ThemeProvider>
  );
}

export default App;