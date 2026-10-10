// Usage: node --env-file=.env.local --experimental-strip-types scripts/ping-model.ts
import { Agent } from "@cline/sdk";
import { getModelConfig } from "../lib/agent/model.ts";

const config = getModelConfig();
if (!config.apiKey) {
  console.error("CLINE_API_KEY is not set (put it in .env.local)");
  process.exit(1);
}

const agent = new Agent({
  ...config,
  systemPrompt: "Reply with a single short line.",
  tools: [],
});

const result = await agent.run("Say hello and name the model you are.");
console.log(`[${config.modelId}] ${result.outputText.trim().split("\n")[0]}`);
