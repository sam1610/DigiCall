import React, { useState, useEffect } from 'react';
import { downloadData } from 'aws-amplify/storage';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';

export interface ChatEvent {
  AbsoluteTime: string;
  ContentType: string;
  Id: string;
  Type: "EVENT" | "MESSAGE";
  ParticipantId?: string;
  DisplayName?: string;
  ParticipantRole?: "CUSTOMER" | "SYSTEM" | "AGENT";
  Content?: string;
}

export interface ConnectTranscript {
  Version: string;
  ContactId: string;
  Transcript: ChatEvent[];
}

interface ChatTranscriptViewerProps {
  // Made this required! The component MUST receive an S3 path now.
  s3Key: string; 
}

export default function ChatTranscriptViewer({ s3Key }: ChatTranscriptViewerProps) {
  const [transcript, setTranscript] = useState<ConnectTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!s3Key) {
      setError("No S3 key provided.");
      setLoading(false);
      return;
    }

    const fetchTranscriptFromS3 = async () => {
      try {
        setLoading(true);
        // Securely fetch the JSON file from the connected S3 bucket
        const { body } = await downloadData({
          path: s3Key, 
        }).result;
        
        const data = await body.json() as ConnectTranscript;
        setTranscript(data);
      } catch (err: any) {
        console.error("Error fetching transcript from S3:", err);
        setError(err.message || "Failed to load transcript.");
      } finally {
        setLoading(false);
      }
    };

    fetchTranscriptFromS3();
  }, [s3Key]);

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Fetching encrypted chat log...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!transcript) return <div className="p-8 text-center text-muted-foreground">No transcript data found.</div>;

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-lg text-slate-800 flex items-center justify-between">
          <span>Chat Log: {transcript.ContactId.split('-')[0]}...</span>
          <span className="text-xs font-normal text-slate-500">
            {new Date(transcript.Transcript[0]?.AbsoluteTime).toLocaleDateString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px] p-4 bg-slate-50/50">
          <div className="flex flex-col space-y-4">
            {transcript.Transcript.map((msg) => {
              if (msg.Type === "EVENT") {
                let action = msg.ContentType.split('.').pop(); 
                return (
                  <div key={msg.Id} className="flex justify-center my-2">
                    <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full uppercase tracking-wider font-semibold">
                      {msg.DisplayName || 'Chat'} {action} • {new Date(msg.AbsoluteTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              const isCustomer = msg.ParticipantRole === "CUSTOMER";
              return (
                <div key={msg.Id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-slate-500 mb-1 ml-1 mr-1 font-medium">
                    {msg.DisplayName}
                  </span>
                  <div 
                    className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm shadow-sm
                      ${isCustomer 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                      }`}
                  >
                    {msg.Content}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 ml-1 mr-1">
                    {new Date(msg.AbsoluteTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}