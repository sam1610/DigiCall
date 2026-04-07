import { LexV2Event, LexV2Result } from 'aws-lambda';
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"; // Fix: Import Command

const sns = new SNSClient({});
const ses = new SESClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: LexV2Event): Promise<LexV2Result> => {
  const intentName = event.sessionState.intent.name;
  const slots = event.sessionState.intent.slots;
  const tenantId = event.requestAttributes?.TenantID || "DEFAULT_TENANT";
  const contactId = event.sessionId;

  // --- 1. CRISIS INTAKE & ALERT ---
  if (intentName === 'CrisisEscalation') {
    const symptoms = slots.Symptoms?.value?.interpretedValue || "Not provided";
    const clinicData = await getClinicProfile(tenantId);
    const doctorMobile = clinicData?.emergencyPhone;

    if (doctorMobile) {
      // Fix: Use .send(new PublishCommand) for SDK v3
      await sns.send(new PublishCommand({
        PhoneNumber: doctorMobile,
        Message: `🚨 CRISIS ALERT (${tenantId}): Patient ${contactId}. Intake: ${symptoms}`
      }));
    }

    await docClient.send(new PutCommand({
      TableName: process.env.CONNECT_DATA_TABLE_NAME,
      Item: { pk: `CUSTOMER#${contactId}`, sk: `CRISIS#${Date.now()}`, tenantId, status: "URGENT", summaryText: symptoms, createdAt: new Date().toISOString() }
    }));

    return buildResponse(intentName, "I've alerted our medical team. Please stay on the line.");
  }

  // --- 2. DYNAMIC APPOINTMENT BOOKING ---
  if (intentName === 'BookAppointment') {
    if (!slots.ProviderName?.value) {
      const doctors = await getDoctorsForClinic(tenantId);
      const buttons = doctors.map(doc => ({ text: doc.name, value: doc.name }));

      return {
        sessionState: {
          dialogAction: { type: 'ElicitSlot', slotToElicit: 'ProviderName' },
          intent: { 
            name: intentName, 
            slots: slots,
            state: 'InProgress' // Fix: Required state field
          }
        },
        messages: [
          { contentType: 'PlainText', content: "Which doctor would you like to see?" },
          {
            contentType: 'ImageResponseCard',
            // Fix: Removed 'content' as it's not a valid property here
            imageResponseCard: { title: 'Select a Provider', buttons: buttons.slice(0, 5) }
          }
        ]
      };
    }
    return buildResponse(intentName, "Appointment confirmed!");
  }

  // --- 4. MEDICATION REFILL ---
  if (intentName === 'MedicationRefill') {
    const medName = slots.MedicationName?.value?.interpretedValue;
    
    await docClient.send(new PutCommand({
      TableName: process.env.CONNECT_DATA_TABLE_NAME,
      Item: {
        pk: `CUSTOMER#${contactId}`,
        sk: `REFILL#${Date.now()}`,
        tenantId: tenantId,
        status: "PENDING",
        summaryText: `Refill: ${medName}`,
        createdAt: new Date().toISOString(),
      }
    }));

    await ses.send(new SendEmailCommand({
      Destination: { ToAddresses: ["clinic-staff@example.com"] },
      Message: {
        Body: { Text: { Data: `Refill Request: ${medName}\nClinic: ${tenantId}` } },
        Subject: { Data: "Medication Refill Alert" }
      },
      Source: "automation@yourdomain.com"
    }));

    return buildResponse(intentName, "Your refill request has been sent to the medical team.");
  }

  return { sessionState: { dialogAction: { type: 'Delegate' }, intent: { name: intentName, state: 'InProgress' } } };
};

// HELPERS
async function getClinicProfile(tenantId: string) {
  const res = await docClient.send(new QueryCommand({
    TableName: process.env.CONNECT_DATA_TABLE_NAME,
    IndexName: 'tenantId-index',
    KeyConditionExpression: "tenantId = :tId",
    FilterExpression: "sk = :profile",
    ExpressionAttributeValues: { ":tId": tenantId, ":profile": "CLINIC_SETTINGS" }
  }));
  return res.Items?.[0];
}

async function getDoctorsForClinic(tenantId: string) {
  const res = await docClient.send(new QueryCommand({
    TableName: process.env.CONNECT_DATA_TABLE_NAME,
    IndexName: 'tenantId', // Changed from 'tenantId-index' to 'tenantId'
    KeyConditionExpression: "tenantId = :tId",
    FilterExpression: "begins_with(pk, :prefix)",
    ExpressionAttributeValues: { ":tId": tenantId, ":prefix": "AGENT#" }
  }));
  return res.Items || [];
}

function buildResponse(intentName: string, message: string): LexV2Result {
  return { 
    sessionState: { 
      dialogAction: { type: 'Close' }, 
      intent: { name: intentName, state: 'Fulfilled' } 
    }, 
    messages: [{ contentType: 'PlainText', content: message }] 
  };
}