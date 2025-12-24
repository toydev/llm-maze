export interface LLMModelConfig {
  model: string;
}

export type LLMConfigData = {
  gemini: Record<string, LLMModelConfig>;
  ollama: Record<string, LLMModelConfig>;
};

export const llmConfig: LLMConfigData = {
  gemini: {
    'gemini-2.5-pro': {
      model: 'gemini-2.5-pro',
    },
    'gemini-2.5-flash': {
      model: 'gemini-2.5-flash',
    },
    'gemini-2.5-flash-lite': {
      model: 'gemini-2.5-flash-lite',
    },
    'gemini-2.0-flash': {
      model: 'gemini-2.0-flash',
    },
  },
  ollama: {},
} as const;
