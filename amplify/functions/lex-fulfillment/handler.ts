import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

/** * CRITICAL FIX: Explicitly tell TypeScript where 'process' comes from in ESM
 */
declare const process: {
  env: {
    CONNECT_DATA_TABLE_NAME: string;
    [key: string]: string | undefined;
  };
};

// Initialize DynamoDB Client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CONNECT_DATA_TABLE_NAME;

export const handler = async (event: any) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // =====================================================================
    // MODE 1: AMAZON CONNECT (Direct Invoke for the Agent Card)
    // =====================================================================
    if (event.Details && event.Details.Parameters) {
        console.log("Handling request from Amazon Connect...");
        const phoneNumber = event.Details.Parameters.phoneNumber;

        // NEW: Check if the calling flow specifically requested JSON format
        const returnJson = event.Details.Parameters.returnJson === "true";

        if (!phoneNumber) {
            return { PatientName: "Unknown", ClinicalNotes: "No phone number provided." };
        }

        try {
            const dynamoResponse = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `PATIENT#${phoneNumber}`, sk: 'METADATA' }
            }));

            let pastRecordsArray: { date: string, symptoms: string }[] = [];

            const historyRes = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
                ExpressionAttributeValues: { ":pk": `PATIENT#${phoneNumber}`, ":sk": "CHECKUP#" },
                ScanIndexForward: false, // Gets newest records first
                Limit: 5
            }));

            if (historyRes.Items && historyRes.Items.length > 0) {
                pastRecordsArray = historyRes.Items.map(item => ({
                    date: item.createdAt.split('T')[0],
                    symptoms: item.symptoms || "No symptoms logged"
                }));
            }

            if (dynamoResponse.Item) {
                return {
                    PatientName: dynamoResponse.Item.name || "Unknown",
                    ClinicalNotes: dynamoResponse.Item.clinicalNotes || "No notes on file.",
                    CustomerPhoneNumber: phoneNumber,
                    // SMART ROUTING: Give an Array to the Screenpop View, but give a String to the Inbound flow!
                    PreviousRecords: returnJson ? pastRecordsArray : JSON.stringify(pastRecordsArray)
                };
            } else {
                return { PatientName: "Not Found", ClinicalNotes: "No record found for this number." };
            }
        } catch (error) {
            console.error("DynamoDB Error during Connect lookup:", error);
            return { PatientName: "Error", ClinicalNotes: "Database lookup failed." };
        }
    }

    // =====================================================================
    // MODE 2: AMAZON BEDROCK AGENT (Action Group)
    // =====================================================================
    const apiPath = event.apiPath;
    let responseBody = {};
    const sessionAttributes: Record<string, string> = event.sessionAttributes || {};

    try {
        // --- ROUTE 1: GET PATIENT PROFILE ---
        if (apiPath === '/patient-profile' && event.httpMethod === 'POST') {
            const properties = event.requestBody?.content['application/json']?.properties || [];
            const phoneNumber = properties.find((p: any) => p.name === 'phoneNumber')?.value;

            if (!phoneNumber) throw new Error("Missing phoneNumber parameter.");
            console.log(`[Bedrock] Looking up patient: ${phoneNumber}`);
            sessionAttributes['PatientPhoneNumber'] = phoneNumber;

            const dynamoResponse = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: `PATIENT#${phoneNumber}`, sk: 'METADATA' }
            }));

            if (dynamoResponse.Item) {
                responseBody = {
                    status: "success",
                    patientFound: true,
                    name: dynamoResponse.Item.name,
                    role: dynamoResponse.Item.role,
                    clinicalNotes: dynamoResponse.Item.clinicalNotes || "No notes on file."
                };
            } else {
                responseBody = { status: "success", patientFound: false, message: "No patient found." };
            }

// --- ROUTE 2: RECORD CHECKUP ---
        } else if (apiPath === '/checkup' && event.httpMethod === 'POST') {
            const properties = event.requestBody?.content['application/json']?.properties || [];
            const symptoms = properties.find((p: any) => p.name === 'symptoms')?.value;

            console.log(`[Bedrock] Successfully recorded symptoms: ${symptoms}`);
            
            // Fix the name to match what Amazon Connect expects
            sessionAttributes['Symptoms'] = symptoms; 

            responseBody = { status: "success", message: "Symptoms recorded." };
            // --- ROUTE 3: ROUTE CALL ---
        } else if (apiPath === '/route-call' && event.httpMethod === 'POST') {
            const properties = event.requestBody?.content['application/json']?.properties || [];
            const targetQueue = properties.find((p: any) => p.name === 'targetQueue')?.value;

            if (!targetQueue) throw new Error("Missing targetQueue parameter");

            responseBody = { status: "success", message: `Transfer initiated to ${targetQueue}.` };
            sessionAttributes['TargetQueue'] = targetQueue;
            sessionAttributes['x-amz-lex:bedrock-agent:end-session'] = "true";

        } else {
            throw new Error(`Unknown API path or method: ${event.httpMethod} ${apiPath}`);
        }

    } catch (error: any) {
        console.error("Error executing action:", error);
        responseBody = { status: "error", message: error.message || "Unknown error" };
    }

    return {
        messageVersion: "1.0",
        response: {
            actionGroup: event.actionGroup,
            apiPath: event.apiPath,
            httpMethod: event.httpMethod,
            httpStatusCode: 200,
            responseBody: {
                "application/json": { body: JSON.stringify(responseBody) }
            }
        },
        sessionAttributes: sessionAttributes
    };
};