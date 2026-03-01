import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  ConnectData: a
    .model({
      // 1. Primary Composite Key
      // For Agents: PK = AGENT#<AgentID>, SK = PROFILE
      // For Customers: PK = CUSTOMER#<Phone>, SK = CALL#<Timestamp>
      pk: a.string().required(), // Partition Key
      sk: a.string().required(), // Sort Key

      // 2. Multi-Tenancy & Routing Attributes
      tenantId: a.string().required(), // e.g., CLINIC_BH_01
      businessPhone: a.string(),      // The dialed clinic number
      emergencyPhone: a.string(),      // The dialed clinic number
      
      // 3. Agent & Customer Details
      name: a.string(),
      status: a.string(),             // Available, Offline, On Break
      skills: a.string().array(),     // e.g., ["English", "Therapy"]
      queueId: a.string(),            // Current queue position or status
      
      // 4. Interaction Metadata (for Wallboards/Analytics)
      sentimentScore: a.float(),
      summaryText: a.string(),
      callDuration: a.integer(),      // In seconds
      callDisposition: a.string(),    // Resolved, Transferred, etc.
      recordingsS3Path: a.string(),   // Link to S3
      
      createdAt: a.datetime(),
    })
    .identifier(['pk', 'sk']) // Enforces Single Table Composite Key
    .secondaryIndexes((index) => [
      // GSI for Multi-Tenant Dashboard: Query all data for one Clinic by Date
      index('tenantId').sortKeys(['createdAt']),
      // GSI for Real-Time Metrics: Query by Status (e.g., all 'Online' agents)
      index('status').sortKeys(['pk']),
    ])
    .authorization((allow) => [
      allow.authenticated('identityPool'), // Lambda access
      allow.owner(),                       // React Frontend access
    ]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});