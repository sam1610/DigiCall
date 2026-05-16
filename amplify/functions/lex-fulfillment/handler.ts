import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  PinpointClient,
  SendOTPMessageCommand,
  VerifyOTPMessageCommand,
} from "@aws-sdk/client-pinpoint";

declare const process: {
  env: {
    CONNECT_DATA_TABLE_NAME: string;
    PINPOINT_APP_ID: string;
    PINPOINT_ORIGINATION_NUMBER: string; // e.g. +1XXXXXXXXXX or your Sender ID
    [key: string]: string | undefined;
  };
};

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = process.env.CONNECT_DATA_TABLE_NAME;

// Pinpoint is region-specific — use the region where your Pinpoint app lives.
// For most accounts outside the US this is us-east-1.
const pinpoint = new PinpointClient({ region: "us-east-1" });
const PINPOINT_APP_ID = process.env.PINPOINT_APP_ID;
const ORIGINATION_NUMBER = process.env.PINPOINT_ORIGINATION_NUMBER;

// ─── helpers ────────────────────────────────────────────────────────────────

function getProp(
  properties: Array<{ name: string; value: string }>,
  name: string
): string | undefined {
  return properties.find((p) => p.name === name)?.value;
}

// ─── Lambda entry point ──────────────────────────────────────────────────────

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // ===========================================================================
  // MODE 1: AMAZON CONNECT — Direct Lambda Invoke (Agent Card / Contact Flow)
  // ===========================================================================
  if (event.Details && event.Details.Parameters) {
    console.log("[Connect] Direct invoke from Amazon Connect...");
    const phoneNumber: string | undefined = event.Details.Parameters.phoneNumber;
    const returnJson = event.Details.Parameters.returnJson === "true";

    if (!phoneNumber) {
      return { PatientName: "Unknown", ClinicalNotes: "No phone number provided." };
    }

    try {
      const [profileRes, historyRes] = await Promise.all([
        docClient.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: `PATIENT#${phoneNumber}`, sk: "METADATA" },
        })),
        docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: {
            ":pk": `PATIENT#${phoneNumber}`,
            ":prefix": "CHECKUP#",
          },
          ScanIndexForward: false,
          Limit: 5,
        })),
      ]);

      const pastRecords = (historyRes.Items ?? []).map((item) => ({
        date: (item.createdAt as string).split("T")[0],
        symptoms: (item.symptoms as string) || "No symptoms logged",
      }));

      if (profileRes.Item) {
        return {
          PatientName: profileRes.Item.name || "Unknown",
          ClinicalNotes: profileRes.Item.clinicalNotes || "No notes on file.",
          CustomerPhoneNumber: phoneNumber,
          PreviousRecords: returnJson ? pastRecords : JSON.stringify(pastRecords),
        };
      }
      return { PatientName: "Not Found", ClinicalNotes: "No record found for this number." };
    } catch (err) {
      console.error("[Connect] DynamoDB error:", err);
      return { PatientName: "Error", ClinicalNotes: "Database lookup failed." };
    }
  }

  // ===========================================================================
  // MODE 2: AMAZON BEDROCK AGENT — Action Group
  // ===========================================================================
  const apiPath: string = event.apiPath;
  const httpMethod: string = event.httpMethod;
  let responseBody: Record<string, unknown> = {};
  const sessionAttributes: Record<string, string> = event.sessionAttributes ?? {};

  try {
    const properties: Array<{ name: string; value: string }> =
      event.requestBody?.content?.["application/json"]?.properties ?? [];

    // ── /request-otp ──────────────────────────────────────────────────────────
    if (apiPath === "/request-otp" && httpMethod === "POST") {
      const phoneNumber = getProp(properties, "phoneNumber");
      if (!phoneNumber) throw new Error("Missing phoneNumber parameter.");

      console.log(`[/request-otp] Sending OTP to ${phoneNumber}`);
      sessionAttributes["PatientPhoneNumber"] = phoneNumber;

      // Check if patient exists in DynamoDB
      const existing = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `PATIENT#${phoneNumber}`, sk: "METADATA" },
      }));
      const patientFound = !!existing.Item;

      // If new patient, create a pending profile so we can register them later
      if (!patientFound) {
        const timestamp = new Date().toISOString();
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: `PATIENT#${phoneNumber}`,
            sk: "METADATA",
            tenantId: "CLINIC_BH_01",
            role: "PATIENT",
            name: "Pending Verification",
            businessPhone: phoneNumber,
            status: "Pending",
            createdAt: timestamp,
          },
        }));
      }

      // Pinpoint generates and sends the OTP — no code stored in DynamoDB
      // referenceId ties this send to the later verify call (use phone as key)
      const referenceId = phoneNumber.replace(/\D/g, ""); // digits only, e.g. "97333787388"

      await pinpoint.send(new SendOTPMessageCommand({
        ApplicationId: PINPOINT_APP_ID,
        SendOTPMessageRequestParameters: {
          Channel: "SMS",
          BrandName: "DigiCall",
          CodeLength: 6,
          ValidityPeriod: 5,          // minutes
          AllowedAttempts: 3,
          Language: "en-US",
          OriginationIdentity: ORIGINATION_NUMBER,
          DestinationIdentity: phoneNumber,
          ReferenceId: referenceId,   // used to verify later
        },
      }));

      console.log(`[/request-otp] OTP dispatched via Pinpoint to ${phoneNumber}`);
      responseBody = {
        status: "success",
        patientFound,
        referenceId,                  // return so the agent can pass it to /verify-otp
        message: patientFound
          ? "Verification code sent to returning patient."
          : "Verification code sent to new patient. Registration required.",
      };

    // ── /verify-otp ───────────────────────────────────────────────────────────
    } else if (apiPath === "/verify-otp" && httpMethod === "POST") {
      const phoneNumber = getProp(properties, "phoneNumber");
      const otp = getProp(properties, "otp");
      const referenceId = getProp(properties, "referenceId")
        ?? (phoneNumber?.replace(/\D/g, "") ?? "");

      if (!phoneNumber || !otp) throw new Error("Missing phoneNumber or otp.");
      console.log(`[/verify-otp] Verifying OTP for ${phoneNumber}`);

      // Pinpoint validates the code — no DynamoDB lookup needed
      const verifyRes = await pinpoint.send(new VerifyOTPMessageCommand({
        ApplicationId: PINPOINT_APP_ID,
        VerifyOTPMessageRequestParameters: {
          DestinationIdentity: phoneNumber,
          ReferenceId: referenceId,
          Otp: otp,
        },
      }));

      const verified = verifyRes.VerificationResponse?.Valid === true;
      console.log(`[/verify-otp] Result for ${phoneNumber}: ${verified}`);

      if (verified) {
        // Fetch patient name to personalise the welcome message
        const profileRes = await docClient.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: `PATIENT#${phoneNumber}`, sk: "METADATA" },
        }));
        const name = (profileRes.Item?.name as string) ?? "Patient";
        sessionAttributes["PatientName"] = name;

        responseBody = {
          status: "success",
          authenticated: true,
          name,
          message: "OTP verified successfully.",
        };
      } else {
        responseBody = {
          status: "success",
          authenticated: false,
          message: "Invalid or expired verification code. Please try again.",
        };
      }

    // ── /register-patient ─────────────────────────────────────────────────────
    } else if (apiPath === "/register-patient" && httpMethod === "POST") {
      const phoneNumber = getProp(properties, "phoneNumber");
      const name = getProp(properties, "name") ?? "Unknown";
      const address = getProp(properties, "address") ?? "Not Provided";

      if (!phoneNumber) throw new Error("Missing phoneNumber for registration.");
      console.log(`[/register-patient] Registering ${name} (${phoneNumber})`);

      const timestamp = new Date().toISOString();
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `PATIENT#${phoneNumber}`,
          sk: "METADATA",
          tenantId: "CLINIC_BH_01",
          role: "PATIENT",
          name,
          address,
          businessPhone: phoneNumber,
          status: "Active",
          createdAt: timestamp,
        },
      }));

      sessionAttributes["PatientName"] = name;
      console.log(`[/register-patient] Registered: ${name}`);
      responseBody = {
        status: "success",
        authenticated: true,
        message: "Patient registered successfully.",
      };

    // ── /checkup ──────────────────────────────────────────────────────────────
    } else if (apiPath === "/checkup" && httpMethod === "POST") {
      const phoneNumber = getProp(properties, "phoneNumber");
      const symptoms = getProp(properties, "symptoms");
      const vitals = getProp(properties, "vitals");

      if (!phoneNumber || !symptoms) throw new Error("Missing phoneNumber or symptoms.");
      console.log(`[/checkup] Recording symptoms for ${phoneNumber}: ${symptoms}`);

      const timestamp = new Date().toISOString();
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `PATIENT#${phoneNumber}`,
          sk: `CHECKUP#${timestamp}`,
          tenantId: "CLINIC_BH_01",
          role: "CHECKUP",
          symptoms,
          vitals: vitals ?? null,
          status: "Pending_Review",
          createdAt: timestamp,
        },
      }));

      sessionAttributes["Symptoms"] = symptoms;
      responseBody = { status: "success", message: "Symptoms recorded successfully." };

    // ── /route-call ───────────────────────────────────────────────────────────
    } else if (apiPath === "/route-call" && httpMethod === "POST") {
      const targetQueue = getProp(properties, "targetQueue");
      if (!targetQueue) throw new Error("Missing targetQueue parameter.");

      console.log(`[/route-call] Routing to: ${targetQueue}`);
      sessionAttributes["TargetQueue"] = targetQueue;
      sessionAttributes["x-amz-lex:bedrock-agent:end-session"] = "true";

      responseBody = {
        status: "success",
        message: `Transferring you to ${targetQueue}. Please hold.`,
      };

    } else {
      throw new Error(`Unhandled route: ${httpMethod} ${apiPath}`);
    }

  } catch (err: any) {
    console.error(`[Bedrock] Error on ${httpMethod} ${apiPath}:`, err);
    responseBody = {
      status: "error",
      message: err.message ?? "An unexpected error occurred.",
    };
  }

  return {
    messageVersion: "1.0",
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: 200,
      responseBody: {
        "application/json": { body: JSON.stringify(responseBody) },
      },
    },
    sessionAttributes,
  };
};
