// amplify/functions/transcript-processor/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const transcriptProcessor = defineFunction({
  name: 'transcriptProcessor',
  entry: './handler.ts',
  timeoutSeconds: 30,
});