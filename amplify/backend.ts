// import { defineBackend } from '@aws-amplify/backend';
// import { auth } from './auth/resource';
// import { data } from './data/resource';
// import { lexFulfillment } from './functions/lex-fulfillment/resource';
// import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

// const backend = defineBackend({
//   auth,
//   data,
//   lexFulfillment,
// });

// // 1. LAMBDA EXECUTION ROLE (DynamoDB, SNS, SES)
// backend.lexFulfillment.resources.lambda.addToRolePolicy(
//   new PolicyStatement({ actions: ['sns:Publish'], resources: ['*'] })
// );

// backend.lexFulfillment.resources.lambda.addToRolePolicy(
//   new PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] })
// );

// const connectDataTable = backend.data.resources.tables['ConnectData'];
// backend.lexFulfillment.resources.lambda.addToRolePolicy(
//   new PolicyStatement({
//     actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
//     resources: [connectDataTable.tableArn, `${connectDataTable.tableArn}/index/*`]
//   })
// );

// backend.lexFulfillment.addEnvironment('CONNECT_DATA_TABLE_NAME', connectDataTable.tableName);

// // 2. LAMBDA RESOURCE POLICY (Allow Bedrock to trigger it)
// backend.lexFulfillment.resources.lambda.addPermission('AllowBedrockInvoke', {
//   principal: new ServicePrincipal('bedrock.amazonaws.com'),
//   action: 'lambda:InvokeFunction'
// });
// // 3. AMAZON CONNECT CUSTOMER PROFILES PERMISSIONS (NEW)
// backend.lexFulfillment.resources.lambda.addToRolePolicy(
//   new PolicyStatement({ 
//     actions: [
//       'profile:SearchProfiles', 
//       'profile:CreateProfile'
//     ], 
//     resources: ['*'] 
//   })
// );

// // Pass the Domain Name to the Lambda
// backend.lexFulfillment.addEnvironment('CONNECT_DOMAIN_NAME', 'amazon-connect-firsthub');

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
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['sns:Publish'], resources: ['*'] })
);

backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] })
);

const connectDataTable = backend.data.resources.tables['ConnectData'];
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
    resources: [connectDataTable.tableArn, `${connectDataTable.tableArn}/index/*`]
  })
);

backend.lexFulfillment.addEnvironment('CONNECT_DATA_TABLE_NAME', connectDataTable.tableName);

// LAMBDA RESOURCE POLICY (Allow Bedrock to trigger it)
backend.lexFulfillment.resources.lambda.addPermission('AllowBedrockInvoke', {
  principal: new ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction'
});

// AMAZON CONNECT CUSTOMER PROFILES PERMISSIONS
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({ 
    actions: [
      'profile:SearchProfiles', 
      'profile:CreateProfile'
    ], 
    resources: ['*'] 
  })
);

// Pass the Domain Name to the Lambda
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