import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { lexFulfillment } from './functions/lex-fulfillment/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  lexFulfillment,
});
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['sns:Publish'],
    resources: ['*'], // Standard for SMS publishing
  })
);
// 1. Grant SES Permission for Emailing Refill Requests
backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  })
);

// 2. Grant DynamoDB Permission for the "Single Table" Model
// We target the 'ConnectData' table created in your data/resource.ts
const connectDataTable = backend.data.resources.tables['ConnectData'];

backend.lexFulfillment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'dynamodb:PutItem',
      'dynamodb:GetItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query'
    ],
    resources: [
      connectDataTable.tableArn,
      `${connectDataTable.tableArn}/index/*` // Required for GSI access patterns
    ],
  })
);

// 3. (Optional) Inject the Table Name as an Environment Variable
// This ensures your handler.ts knows exactly which table to write to
backend.lexFulfillment.addEnvironment(
  'CONNECT_DATA_TABLE_NAME',
  connectDataTable.tableName
);