// import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// const schema = a.schema({
//   ConnectData: a
//     .model({
//       // Patterns: PATIENT#<Phone>, AGENT#<Username>, or TENANT#<Id>
//       pk: a.string().required(),
//       // Patterns: METADATA, CHECKUP#<Timestamp>, or SESSION#<ContactId>
//       sk: a.string().required(),

//       // 2. Identity & Multi-Tenancy
//       tenantId: a.string().required(),
//       role: a.string().required(), // "AGENT", "PATIENT", or "CHECKUP"
//       name: a.string(),
//       status: a.string(),             

//       // 3. Agent-Specific Attributes
//       skills: a.string().array(),     
//       queueId: a.string(),            
      
//       // 4. Clinical & Patient-Specific Attributes (The "Card" Requirements)
//       // Store blood pressure, temp, etc., as a JSON string for frontend cards
//       vitals: a.json(), 
//       symptoms: a.string(),
//       diagnosis: a.string(),
//       clinicalNotes: a.string(),
//       providerId: a.string(), // Links a checkup to the Agent who performed it
      
//       // 5. Interaction & Routing Metadata
//       businessPhone: a.string(),
//       emergencyPhone: a.string(),
//       sentimentScore: a.float(),
//       summaryText: a.string(),
//       callDuration: a.integer(),      
//       callDisposition: a.string(),    
//       recordingsS3Path: a.string(),   
      
//       createdAt: a.datetime(),
//     })
//     .identifier(['pk', 'sk'])
//     .secondaryIndexes((index) => [
//       // Index for Supervisor dashboards filtered by Clinic
//       index('tenantId')
//         .sortKeys(['createdAt'])
//         .name('tenantId-index'),
//       // Index for Agent availability or Patient urgency status
//       index('role')
//         .sortKeys(['status'])
//         .name('role-status-index'),
//       // Index to fetch all history for a specific patient across dates
//       index('pk')
//         .sortKeys(['createdAt'])
//         .name('patient-history-index')
//     ])
//     .authorization((allow) => [
//       allow.authenticated('identityPool'), 
//       allow.owner(),
//       allow.publicApiKey().to(['read', 'create', 'update']), 
//     ]),
// });

// export type Schema = ClientSchema<typeof schema>;

// export const data = defineData({
//   schema,
//   authorizationModes: {
//     defaultAuthorizationMode: 'userPool',
//     apiKeyAuthorizationMode: {
//       description: 'API Key for Lex Fulfillment and External Integrations',
//       expiresInDays: 30 
//     }
//   },
// });



// Hierarchical Access Patterns:

// Patient Profile: Set pk: "PATIENT#+973..." and sk: "METADATA".

// Checkup History: Set pk: "PATIENT#+973..." and sk: "CHECKUP#2026-03-05T12:00:00".

// This allows an agent to query all records starting with CHECKUP# for a specific patient to populate the historical cards on their screen.

// Flexible Vitals (JSON):

// The vitals field is now a JSON type. This allows you to store a dynamic set of data (e.g., { "bp": "120/80", "heartRate": 72, "temp": 37.5 }) that directly maps to the fields in your "Checkup Card" UI.

// Role-Status Indexing:

// The new role-status-index allows a Supervisor to quickly see all "AGENT" records with a status of "Available" or all "PATIENT" records with a status of "URGENT_CRISIS."

// Provider Traceability:

// The providerId field allows the system to track which Agent was responsible for which clinical checkup, creating a clear audit trail for the clinic.


// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // 1. YOUR EXISTING MEDICAL RECORD TABLE
  ConnectData: a
    .model({
      pk: a.string().required(),
      sk: a.string().required(),
      tenantId: a.string().required(),
      role: a.string().required(), 
      name: a.string(),
      status: a.string(),             
      skills: a.string().array(),     
      queueId: a.string(),            
      vitals: a.json(), 
      symptoms: a.string(),
      diagnosis: a.string(),
      clinicalNotes: a.string(),
      providerId: a.string(), 
      businessPhone: a.string(),
      emergencyPhone: a.string(),
      sentimentScore: a.float(),
      summaryText: a.string(),
      callDuration: a.integer(),      
      callDisposition: a.string(),    
      recordingsS3Path: a.string(),   
      createdAt: a.datetime(),
    })
    .identifier(['pk', 'sk'])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('tenantId-index'),
      index('role').sortKeys(['status']).name('role-status-index'),
      index('pk').sortKeys(['createdAt']).name('patient-history-index')
    ])
    .authorization((allow) => [
      allow.authenticated('identityPool'), 
      allow.owner(),
      allow.publicApiKey().to(['read', 'create', 'update']), 
    ]),

  // 2. NEW: OPTIMIZED DASHBOARD TRANSCRIPT TABLE
  ChatTranscript: a
    .model({
      contactId: a.id().required(),
      initiationTimestamp: a.datetime().required(),
      durationSeconds: a.integer(),
      channel: a.string(),
      fullTranscriptJson: a.json(), // Stores the parsed array of messages
    })
    .authorization((allow) => [
      allow.authenticated('identityPool'),
      allow.publicApiKey().to(['read']), 
      allow.guest().to(['read']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      description: 'API Key for Lex Fulfillment and External Integrations',
      expiresInDays: 30 
    }
  },
});