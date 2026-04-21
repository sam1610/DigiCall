// amplify/functions/clinic-mcp-server/handler.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({});
const TABLE_NAME = process.env.CONNECT_DATA_TABLE_NAME;

// 1. Initialize the MCP Server
const server = new Server({
  name: "digicall-clinic-tools",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

// 2. Define the Tools (This replaces your OpenAPI Schema!)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "requestOtp",
        description: "Checks if a patient exists and sends a 4-digit SMS verification code.",
        inputSchema: {
          type: "object",
          properties: {
            phoneNumber: { type: "string", description: "Patient's full phone number (e.g. +973...)" }
          },
          required: ["phoneNumber"]
        }
      },
      {
        name: "registerPatient",
        description: "Registers a new patient profile after OTP is verified.",
        inputSchema: {
          type: "object",
          properties: {
            phoneNumber: { type: "string" },
            name: { type: "string" },
            address: { type: "string" },
            otp: { type: "string", description: "The 4-digit code provided by the user" }
          },
          required: ["phoneNumber", "name", "address", "otp"]
        }
      }
      // Add verifyOtp and recordCheckup here...
    ]
  };
});

// 3. Execute the Tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "requestOtp") {
      const phoneNumber = String(args?.phoneNumber);
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      
      const dynamoResponse = await docClient.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: `PATIENT#${phoneNumber}`, sk: 'METADATA' }
      }));

      // Send SMS logic here...
      console.log(`DEVELOPER OVERRIDE: The OTP for ${phoneNumber} is ${otp}`);

      return {
        content: [{ 
            type: "text", 
            text: JSON.stringify({ 
                status: "success", 
                patientFound: !!dynamoResponse.Item,
                message: "OTP sent successfully." 
            }) 
        }]
      };
    }

    if (name === "registerPatient") {
        // Execute DynamoDB registration logic here...
        return {
            content: [{ type: "text", text: JSON.stringify({ status: "success", message: "Patient registered." }) }]
        };
    }

    throw new Error(`Tool not found: ${name}`);

  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${error.message}` }],
      isError: true
    };
  }
});

// 4. Lambda Handler entry point
export const handler = async (event: any) => {
    // AgentCore Gateway will pass the MCP protocol requests directly into this handler
    // Your server processes the standardized request and returns the standardized response
    console.log("Received MCP Request:", JSON.stringify(event));
    
    // (Transport adaptation for AWS Lambda goes here)
    return { statusCode: 200, body: "MCP Server Active" };
};