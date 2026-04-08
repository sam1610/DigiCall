import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'connectTranscripts',
  access: (allow) => ({
    'ChatTranscripts/*': [
      allow.authenticated.to(['read']) // Allows logged-in users to read the files
    ]
  })
});