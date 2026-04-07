import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { lexFulfillment } from './functions/lex-fulfillment/resource';
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  lexFulfillment,
});

// 1. LAMBDA EXECUTION ROLE (DynamoDB, SNS, SES)
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

// 2. LAMBDA RESOURCE POLICY (Allow Bedrock to trigger it)
backend.lexFulfillment.resources.lambda.addPermission('AllowBedrockInvoke', {
  principal: new ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction'
});
// 3. AMAZON CONNECT CUSTOMER PROFILES PERMISSIONS (NEW)
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