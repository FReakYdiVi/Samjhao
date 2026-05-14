import { SarvamAIClient } from "sarvamai";

let client: SarvamAIClient | null | undefined;

export function hasSarvamKey() {
  return Boolean(process.env.SARVAM_API_KEY);
}

export function getSarvamClient() {
  if (client !== undefined) {
    return client;
  }

  const apiKey = process.env.SARVAM_API_KEY;
  client = apiKey ? new SarvamAIClient({ apiSubscriptionKey: apiKey }) : null;
  return client;
}
