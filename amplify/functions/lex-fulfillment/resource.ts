import { defineFunction } from '@aws-amplify/backend';

export const lexFulfillment = defineFunction({
  name: 'lex-fulfillment',
  entry: './handler.ts',
});