import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { lexFulfillment } from './functions/lex-fulfillment/resource';
import { transcriptProcessor } from './functions/transcript-processor/resource'; // <-- NEW
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3'; // <-- NEW
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'; // <-- NEW

const backend = defineBackend({
  auth,
  data,
  lexFulfillment,
  transcriptProcessor, // <-- NEW
});

// ====================================================================
// 1. LEX FULFILLMENT PERMISSIONS (Existing)
// ====================================================================

// SNS (kept for any future use, can be removed if fully on Pinpoint)
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['sns:Publish'], resources: ['*'] })
);

backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] })
);

// DynamoDB
const connectDataTable = backend.data.resources.tables['ConnectData'];
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
    resources: [connectDataTable.tableArn, `${connectDataTable.tableArn}/index/*`]
  })
);
backend.lexFulfillment.addEnvironment('CONNECT_DATA_TABLE_NAME', connectDataTable.tableName);

// Amazon Pinpoint — SendOTPMessage and VerifyOTPMessage
// Replace the two placeholder values below with your real Pinpoint App ID
// and origination number (or Sender ID) from the Pinpoint console.
const PINPOINT_APP_ID = 'YOUR_PINPOINT_APP_ID';           // e.g. "a1b2c3d4e5f6..."
const PINPOINT_ORIGINATION_NUMBER = 'YOUR_ORIGINATION_NUMBER'; // e.g. "+12025551234" or "DigiCall"

backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'mobiletargeting:SendOTPMessage',
      'mobiletargeting:VerifyOTPMessage',
    ],
    resources: [`arn:aws:mobiletargeting:us-east-1:*:apps/${PINPOINT_APP_ID}*`],
  })
);
backend.lexFulfillment.addEnvironment('PINPOINT_APP_ID', PINPOINT_APP_ID);
backend.lexFulfillment.addEnvironment('PINPOINT_ORIGINATION_NUMBER', PINPOINT_ORIGINATION_NUMBER);

// Allow Bedrock to invoke the Lambda
backend.lexFulfillment.resources.lambda.addPermission('AllowBedrockInvoke', {
  principal: new ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction'
});

// Amazon Connect Customer Profiles
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({ 
    actions: ['profile:SearchProfiles', 'profile:CreateProfile'], 
    resources: ['*'] 
  })
);

backend.lexFulfillment.addEnvironment('CONNECT_DOMAIN_NAME', 'amazon-connect-firsthub');


// ====================================================================
// 2. TRANSCRIPT PROCESSOR PERMISSIONS & S3 TRIGGER (NEW)
// ====================================================================

// A. Grant the Lambda permission to write to the new ChatTranscript table
const transcriptTable = backend.data.resources.tables['ChatTranscript'];
backend.transcriptProcessor.addEnvironment('TRANSCRIPT_TABLE_NAME', transcriptTable.tableName);

backend.transcriptProcessor.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem'],
    resources: [transcriptTable.tableArn]
  })
);

// B. Grant the Lambda permission to read from your existing Amazon Connect S3 bucket
const connectBucketName = 'amazon-connect-digial-call-bh';
backend.transcriptProcessor.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`arn:aws:s3:::${connectBucketName}/*`]
  })
);

// C. Tell the existing S3 bucket to trigger the Lambda when a new chat transcript arrives
const connectBucket = s3.Bucket.fromBucketName(
  backend.transcriptProcessor.resources.lambda.stack, 
  'ConnectBucket', 
  connectBucketName
);

connectBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED, 
  new s3n.LambdaDestination(backend.transcriptProcessor.resources.lambda),
  { prefix: 'connect/firsthub/ChatTranscripts/' } // Only trigger for chat JSONs
);