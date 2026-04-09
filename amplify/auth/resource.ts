// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Optional: Ask for their name during sign up
  userAttributes: {
    preferredUsername: {
      mutable: true,
      required: false,
    },
  },
  // We can create specific groups for role-based access later
  groups: ['supervisor', 'agent'],
});