import { Authenticator } from '@aws-amplify/ui-react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
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
import ProtectedRoute from './components/ProtectedRoute';
import ChatTranscriptViewer from './components/ChatTranscriptViewer'; // <-- ADD THIS IMPORT

import './App.css';
import '@aws-amplify/ui-react/styles.css';

// Using your exact JSON payload for local testing
const sampleChatData = {
  "Version":"2019-08-26",
  "AWSAccountId":"770961405135",
  "InstanceId":"0cb42924-3bcc-4f0b-a7d0-dbf5770fabfd",
  "InitialContactId":"8194a906-ef39-4e6d-8ccc-a924ed53fc2a",
  "ContactId":"8194a906-ef39-4e6d-8ccc-a924ed53fc2a",
  "Participants":[{"ParticipantId":"61820ec4-3389-4446-9504-84bdedb27146"},{"ParticipantId":"4ff6d032-aa75-4ec8-80a2-5f9fccb7f945"}],
  "Transcript":[
    {"AbsoluteTime":"2026-04-07T08:45:33.965Z","ContentType":"application/vnd.amazonaws.connect.event.participant.joined","Id":"019d671e-538d-7be5-b375-334d2b36e7b3","Type":"EVENT","ParticipantId":"4ff6d032-aa75-4ec8-80a2-5f9fccb7f945","DisplayName":"Customer","ParticipantRole":"CUSTOMER"},
    {"AbsoluteTime":"2026-04-07T08:45:41.351Z","Content":"hank you for calling the clinic. How can I help you today?","ContentType":"text/plain","Id":"019d671e-7067-7478-b245-8573f4c49f2c","Type":"MESSAGE","ParticipantId":"61820ec4-3389-4446-9504-84bdedb27146","DisplayName":"BOT","ParticipantRole":"SYSTEM"},
    {"AbsoluteTime":"2026-04-07T10:37:14.009Z","ContentType":"application/vnd.amazonaws.connect.event.participant.left","Id":"019d6784-8f99-7f4b-8f13-b8dc35ed3a32","Type":"EVENT","ParticipantId":"4ff6d032-aa75-4ec8-80a2-5f9fccb7f945","DisplayName":"Customer","ParticipantRole":"CUSTOMER"},
    {"AbsoluteTime":"2026-04-07T10:37:14.187Z","ContentType":"application/vnd.amazonaws.connect.event.chat.ended","Id":"019d6784-904b-737e-8157-668282383296","Type":"EVENT"}
  ]
} as any;

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Authenticator.Provider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* ADDED TRANSCRIPT TEST ROUTE */}
            <Route path="/transcript-test" element={
              <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
                <ChatTranscriptViewer mockData={sampleChatData} />
                {/* To fetch a real file from S3 later, use: 
                    <ChatTranscriptViewer s3Key="ChatTranscripts/2026/04/07/your-contact-id.json" /> 
                */}
              </div>
            } />

            <Route path="/agent" element={
              <ProtectedRoute allowedRoles={['agent']}>
                <AgentLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AgentHome />} />
              <Route path="notifications" element={<AgentNotifications />} />
              <Route path="performance" element={<AgentPerformance />} />
              <Route path="exemplars" element={<AgentExemplars />} />
            </Route>

            <Route path="/supervisor" element={
              <ProtectedRoute allowedRoles={['supervisor']}>
                <SupervisorLayout />
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
      </Authenticator.Provider>
    </ThemeProvider>
  );
}

export default App;