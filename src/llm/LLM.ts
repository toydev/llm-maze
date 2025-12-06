import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

import { llmConfig } from '@/llm/LLMConfig';
import { StructuredChatOllama } from '@/llm/StructuredChatOllama';

export default class LLM {
  static llms: Record<string, LLM> = {};

  static get(target: string) {
    if (LLM.llms[target]) return LLM.llms[target];

    // targetを type:model 形式でパース
    // ollama:gemma3:12b のように model 部分にコロンが含まれる場合に対応
    const parts = target.split(':');
    const type = parts[0];
    const modelName = parts.slice(1).join(':');

    let result = null;
    switch (type) {
      case 'ollama': {
        // 設定があればそれを使用、なければmodelNameをそのまま使用
        const config = llmConfig.ollama[modelName];
        const actualModel = config?.model ?? modelName;
        result = new LLM(new StructuredChatOllama({ model: actualModel }));
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

  private llm: ChatGoogleGenerativeAI | StructuredChatOllama;

  constructor(llm: ChatGoogleGenerativeAI | StructuredChatOllama) {
    this.llm = llm;
  }

  /**
   * 構造化出力用のLLMインスタンスを取得
   * Zodスキーマに基づいた型安全な出力を保証する
   *
   * レート制限はLangChainのwithRetry()が持つexponential backoffで対応
   *
   * 実装の詳細:
   * - ChatGoogleGenerativeAI.withStructuredOutput は複数のオーバーロードを持つ
   * - union型に対してメソッドを直接呼び出すと、TypeScriptが型を統一できずエラーになる
   * - 型ガードで分岐することで、それぞれの具体的な型として安全に呼び出せる
   * - 戻り値は両者とも Runnable を返すため、使用側では問題なく動作する
   */
  withStructuredOutput<T extends z.ZodType>(schema: T) {
    if (this.llm instanceof StructuredChatOllama) {
      return this.llm.withStructuredOutput(schema);
    } else {
      return this.llm.withStructuredOutput(schema);
    }
  }

  /**
   * LLMに直接リクエストを送信（design/llm-cli用）
   * リトライやレート制限なし、シンプルにLLMを呼び出すのみ
   */
  async invoke(request: BaseLanguageModelInput) {
    return await this.llm.invoke(request);
  }
}
