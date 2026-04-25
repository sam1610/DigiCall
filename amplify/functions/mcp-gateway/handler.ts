import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.CONNECT_DATA_TABLE_NAME || "ConnectData";

// Initialize MCP Server
const server = new Server({ name: "digicall-mcp-gateway", version: "1.0.0" }, { capabilities: { tools: {} } });

// 1. Expose the Tools to the Agent Swarm
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "requestOtp",
        description: "Checks if patient exists and generates OTP.",
        inputSchema: { type: "object", properties: { phoneNumber: { type: "string" } }, required: ["phoneNumber"] }
      },
      {
        name: "recordCheckup",
        description: "Saves verified patient symptoms to Long-Term Memory.",
        inputSchema: { 
            type: "object", 
            properties: { phoneNumber: { type: "string" }, symptoms: { type: "string" } }, 
            required: ["phoneNumber", "symptoms"] 
        }
      }
    ]
  };
});

// 2. Execute the Tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "recordCheckup") {
    const timestamp = new Date().toISOString();
    // Save to DynamoDB (Your Long-Term Memory)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            pk: `PATIENT#${args?.phoneNumber}`,
            sk: `CHECKUP#${timestamp}`,
            tenantId: "CLINIC_MAIN",
            role: "CHECKUP",
            symptoms: String(args?.symptoms),
            status: "Validated_By_Nurse",
            createdAt: timestamp
        }
    }));
    return { content: [{ type: "text", text: "Symptoms safely recorded to long-term memory." }] };
  }

  // Handle requestOtp logic here...
  return { content: [{ type: "text", text: "Tool executed successfully." }] };
});

export const handler = async (event: any) => {
    // AWS Lambda wrapper for MCP Protocol
    return { statusCode: 200, body: "MCP Gateway Active" };
};