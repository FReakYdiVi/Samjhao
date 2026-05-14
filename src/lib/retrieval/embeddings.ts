type EmbeddingProvider = "google" | "openai";
type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions?: number;
}

interface EmbeddingInput {
  text: string;
  title?: string;
}

function getEmbeddingConfig(): EmbeddingConfig | null {
  const provider =
    (process.env.EMBEDDINGS_PROVIDER as EmbeddingProvider | undefined) ||
    (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY ? "google" : undefined) ||
    (process.env.EMBEDDINGS_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_EMBEDDINGS_API_KEY
      ? "openai"
      : undefined);

  if (!provider) {
    return null;
  }

  const dimensionsRaw = process.env.EMBEDDINGS_DIMENSIONS;
  const dimensions = dimensionsRaw ? Number(dimensionsRaw) : undefined;

  if (provider === "google") {
    const apiKey =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.EMBEDDINGS_API_KEY;

    if (!apiKey) {
      return null;
    }

    return {
      provider,
      apiKey,
      baseUrl:
        process.env.EMBEDDINGS_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta",
      model: process.env.EMBEDDINGS_MODEL || "gemini-embedding-002",
      dimensions: Number.isFinite(dimensions) ? dimensions : undefined,
    };
  }

  const apiKey =
    process.env.EMBEDDINGS_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_EMBEDDINGS_API_KEY;

  if (!apiKey) {
    return null;
  }

  return {
    provider,
    apiKey,
    baseUrl:
      process.env.EMBEDDINGS_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1",
    model: process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
    dimensions: Number.isFinite(dimensions) ? dimensions : undefined,
  };
}

export function hasEmbeddingProvider() {
  return Boolean(getEmbeddingConfig());
}

export function getEmbeddingProviderName() {
  return getEmbeddingConfig()?.provider ?? null;
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

interface GoogleBatchEmbeddingResponse {
  embeddings?: Array<{
    values?: number[];
  }>;
}

async function createOpenAIEmbeddings(
  config: EmbeddingConfig,
  inputs: EmbeddingInput[],
) {
  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: inputs.map((input) => input.text),
      encoding_format: "float",
      ...(config.dimensions ? { dimensions: config.dimensions } : {}),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Embedding request failed: ${message}`);
  }

  const payload = (await response.json()) as OpenAIEmbeddingResponse;
  return payload.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function createGoogleEmbeddings(
  config: EmbeddingConfig,
  inputs: EmbeddingInput[],
  taskType: EmbeddingTaskType,
) {
  const modelPath = config.model.startsWith("models/")
    ? config.model
    : `models/${config.model}`;
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/${modelPath}:batchEmbedContents?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: inputs.map((input) => ({
        model: modelPath,
        content: {
          parts: [{ text: input.text }],
        },
        taskType,
        ...(taskType === "RETRIEVAL_DOCUMENT" && input.title
          ? { title: input.title }
          : {}),
        ...(config.dimensions ? { outputDimensionality: config.dimensions } : {}),
      })),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google embedding request failed: ${message}`);
  }

  const payload = (await response.json()) as GoogleBatchEmbeddingResponse;
  return (payload.embeddings ?? []).map((embedding) => embedding.values ?? []);
}

async function createEmbeddings(
  inputs: EmbeddingInput[],
  taskType: EmbeddingTaskType,
) {
  const config = getEmbeddingConfig();
  if (!config || inputs.length === 0) {
    return null;
  }

  if (config.provider === "google") {
    return createGoogleEmbeddings(config, inputs, taskType);
  }

  return createOpenAIEmbeddings(config, inputs);
}

export async function embedTexts(
  inputs: Array<string | EmbeddingInput>,
  options?: {
    taskType?: EmbeddingTaskType;
  },
) {
  const normalizedInputs = inputs.map((input) =>
    typeof input === "string" ? { text: input } : input,
  );

  return createEmbeddings(
    normalizedInputs,
    options?.taskType ?? "RETRIEVAL_DOCUMENT",
  );
}

export async function embedQuery(input: string) {
  const response = await createEmbeddings([{ text: input }], "RETRIEVAL_QUERY");
  return response?.[0] ?? null;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
