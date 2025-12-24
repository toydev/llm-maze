import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';

import { llmConfig } from '@/llm/LLMConfig';

export default class LLM {
  static llms: Record<string, LLM> = {};

  static get(target: string) {
    if (LLM.llms[target]) return LLM.llms[target];

    const parts = target.split(':');
    const type = parts[0];
    const modelName = parts.slice(1).join(':');

    let result = null;
    switch (type) {
      case 'ollama': {
        const config = llmConfig.ollama[modelName];
        const actualModel = config?.model ?? modelName;
        result = new LLM(new ChatOllama({ model: actualModel }));
        break;
      }
      case 'gemini': {
        const config = llmConfig.gemini[modelName];
        if (config) {
          result = new LLM(
            new ChatGoogleGenerativeAI({
              model: config.model,
              apiKey: process.env.LLM_GEMINI_API_KEY,
            }),
          );
        }
        break;
      }
    }

    if (result) LLM.llms[target] = result;
    return result;
  }

  private llm: ChatGoogleGenerativeAI | ChatOllama;

  constructor(llm: ChatGoogleGenerativeAI | ChatOllama) {
    this.llm = llm;
  }

  withStructuredOutput<T extends z.ZodType>(schema: T) {
    return this.llm.withStructuredOutput(schema);
  }

  async invoke(request: BaseLanguageModelInput) {
    return await this.llm.invoke(request);
  }
}
