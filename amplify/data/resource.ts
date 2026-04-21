// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  ConnectData: a
    .model({
      pk: a.string().required(),
      sk: a.string().required(),
      tenantId: a.string().required(),
      role: a.string().required(), 
      name: a.string(),
      address: a.string(),            // <--- NEW: Added for patient registration
      currentOtp: a.string(),         // <--- NEW: Added for Passwordless OTP auth
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
    // UPDATE: Use UserPools for users, API Key for backend Lambdas
    .authorization((allow) => [
      allow.authenticated('userPools').to(['read', 'create']), 
      allow.owner(), // The user who created the record has full CRUD
      allow.publicApiKey().to(['read', 'create', 'update']), // For your Lambdas
    ]),

  ChatTranscript: a
    .model({
      contactId: a.id().required(),
      initiationTimestamp: a.datetime().required(),
      durationSeconds: a.integer(),
      channel: a.string(),
      fullTranscriptJson: a.json(), 
    })
    .authorization((allow) => [
      allow.authenticated('userPools').to(['read']), // Any logged-in agent can read
      allow.publicApiKey().to(['read', 'create', 'update']), // S3 Lambda writes data using this
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // ALL UI queries default to Cognito
    apiKeyAuthorizationMode: {
      description: 'API Key for Lex Fulfillment and S3 Lambdas',
      expiresInDays: 30 
    }
  },
});