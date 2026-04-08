// amplify/functions/transcript-processor/handler.ts
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TRANSCRIPT_TABLE_NAME;

export const handler = async (event: any) => {
    console.log("Received S3 Event:", JSON.stringify(event, null, 2));

    try {
        // 1. Get the bucket and file name from the S3 Event
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        // 2. Fetch the actual JSON file from S3
        const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const fileContent = await s3Response.Body?.transformToString();
        if (!fileContent) throw new Error("Empty file");

        const rawData = JSON.parse(fileContent);

        // 3. Calculate duration
        // 3. Calculate duration safely
        let duration = 0;
        if (rawData.Transcript && rawData.Transcript.length > 1) {
            const firstMessageTime = new Date(rawData.Transcript[0].AbsoluteTime).getTime();
            const lastMessageTime = new Date(rawData.Transcript[rawData.Transcript.length - 1].AbsoluteTime).getTime();
            duration = Math.round((lastMessageTime - firstMessageTime) / 1000);
        } else {
            console.log("Chat had no actual messages.");
        }

        // 4. Clean the transcript for the frontend
        const cleanTranscript = rawData.Transcript
            .filter((t: any) => t.Type === "MESSAGE")
            .map((t: any) => ({
                role: t.ParticipantRole,
                content: t.Content,
                time: t.AbsoluteTime
            }));

        // 5. Save directly to the Amplify Data DynamoDB Table
        const timestamp = new Date().toISOString();
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                id: rawData.ContactId, // Required for AppSync 'id' field
                contactId: rawData.ContactId,
                initiationTimestamp: rawData.Transcript[0].AbsoluteTime,
                durationSeconds: duration,
                channel: "CHAT",
                fullTranscriptJson: cleanTranscript,
                __typename: "ChatTranscript", // Required for GraphQL to recognize it
                createdAt: timestamp,
                updatedAt: timestamp
            }
        }));

        console.log("Successfully processed and saved transcript:", rawData.ContactId);
        return { statusCode: 200, body: "Success" };

    } catch (error) {
        console.error("Error processing transcript:", error);
        throw error;
    }
};