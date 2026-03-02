import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  ConnectData: a
    .model({
      // 1. Primary Composite Key
      pk: a.string().required(),
      sk: a.string().required(),

      // 2. Multi-Tenancy & Routing Attributes
      tenantId: a.string().required(),
      businessPhone: a.string(),
      emergencyPhone: a.string(),
      
      // 3. Agent & Customer Details
      name: a.string(),
      status: a.string(),             
      skills: a.string().array(),     
      queueId: a.string(),            
      
      // 4. Interaction Metadata
      sentimentScore: a.float(),
      summaryText: a.string(),
      callDuration: a.integer(),      
      callDisposition: a.string(),    
      recordingsS3Path: a.string(),   
      
      createdAt: a.datetime(),
    })
    .identifier(['pk', 'sk'])
    .secondaryIndexes((index) => [
      // Explicitly named to match your Lambda handler.ts logic
      index('tenantId')
      .sortKeys(['createdAt'])
      .name('tenantId-index') ,
      index('status')
      .sortKeys(['pk'])
      .name('status-index')
    ])
    .authorization((allow) => [
      // 1. Allows your Lex Lambda (via IAM/Identity Pool) to query
      allow.authenticated('identityPool'), 
      // 2. Allows your React Frontend (via Cognito) to manage data
      allow.owner(),
      // 3. Optional: Allows API Key access if your Lambda uses it (matching your inspiration)
      allow.publicApiKey().to(['read', 'create', 'update']), 
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Matches your React frontend authentication
    defaultAuthorizationMode: 'userPool',
    
    // FIX: Changed from apiKeyConfig to apiKeyAuthorizationMode
    apiKeyAuthorizationMode: {
      description: 'API Key for Lex Fulfillment and External Integrations',
      expiresInDays: 30 
    }
  },
});