import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { RunnableLambda } from '@langchain/core/runnables';
import ollama from 'ollama';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Ollama のラッパークラス（一時的な回避策）
 *
 * LangChain.js の ChatOllama.withStructuredOutput() が正しく動作しないため、
 * ollama パッケージを直接使用し、Gemini の ChatGoogleGenerativeAI と同じように withStructuredOutput() を使えるようにする
 *
 * TODO: LangChain.js の ollama パッケージで withStructuredOutput が正しく動作するようになったら ChatOllama に戻す
 */
export class StructuredChatOllama {
  private model: string;
  private baseUrl?: string;

  constructor(config: { model: string; baseUrl?: string }) {
    this.model = config.model;
    this.baseUrl = config.baseUrl;
  }

  /**
   * 構造化出力を有効にする
   * Gemini の withStructuredOutput() と同じインターフェースを提供
   *
   * ollama パッケージを直接使用することで、format パラメータが正しく機能する
   */
  withStructuredOutput<T extends z.ZodType>(schema: T) {
    const model = this.model;
    const baseUrl = this.baseUrl;
    // const format = zodToJsonSchema(schema as any); // スキーマ生成を無効化
    const format = 'json'; // 単純な 'json' 形式を要求

    // RunnableLambda で Runnable として振る舞うオブジェクトを返す
    return new RunnableLambda({
      func: async (input: BaseLanguageModelInput) => {
        // LangChain の入力形式を ollama の形式に変換
        const messages = this.convertToOllamaMessages(input);

        // ollama パッケージで直接呼び出し
        const response = await ollama.chat({
          model,
          messages,
          format,
          ...(baseUrl && { host: baseUrl }),
        });

        // JSON パースして型付きオブジェクトを返す
        if (response?.message?.content && typeof response.message.content === 'string') {
          try {
            const parsedJson = JSON.parse(response.message.content);
            return schema.parse(parsedJson) as z.infer<T>; // Zodスキーマで検証
          } catch (e) {
            console.error('Failed to parse or validate LLM response:', e);
            // エラー時でも後続の処理が止まらないように、推論させた型で空のオブジェクトなどを返すか、エラーを投げるか選択
            // ここではエラーを投げて、呼び出し元で対処させる
            throw new Error('LLM response is not a valid JSON or does not match the schema.');
          }
        }

        throw new Error('LLM did not return any content.');
      },
    });
  }

  /**
   * LangChain の入力形式を ollama の形式に変換
   */
  private convertToOllamaMessages(input: BaseLanguageModelInput): Array<{ role: string; content: string; images?: string[] }> {
    // 配列の場合
    if (Array.isArray(input)) {
      return (input as any[]).map((item: any) => {
        // タプル形式 [role, content]
        if (Array.isArray(item) && item.length === 2) {
          return { role: item[0] as string, content: item[1] as string };
        }
        // オブジェクト形式 { role, content }
        if (typeof item === 'object' && item !== null && 'role' in item && 'content' in item) {
          return this.convertMessageContent(item.role as string, item.content);
        }
        // その他の形式
        return { role: 'user', content: String(item) };
      });
    }

    // 文字列の場合
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }

    // その他の場合はデフォルト
    return [{ role: 'user', content: String(input) }];
  }

  /**
   * メッセージの content を Ollama 形式に変換
   * LangChain では content が配列（マルチモーダル）の場合があるため、適切に変換する
   */
  private convertMessageContent(role: string, content: any): { role: string; content: string; images?: string[] } {
    // content が文字列の場合はそのまま
    if (typeof content === 'string') {
      return { role, content };
    }

    // content が配列の場合（マルチモーダル対応）
    if (Array.isArray(content)) {
      const texts: string[] = [];
      const images: string[] = [];

      for (const part of content) {
        if (typeof part === 'object' && part !== null) {
          // テキスト部分を抽出
          if (part.type === 'text' && typeof part.text === 'string') {
            texts.push(part.text);
          }
          // 画像部分を抽出
          else if (part.type === 'image_url' && part.image_url) {
            const imageUrl = typeof part.image_url === 'string' ? part.image_url : part.image_url.url;
            if (typeof imageUrl === 'string') {
              // data:image形式からbase64部分を抽出
              const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
              if (base64Match) {
                images.push(base64Match[1]);
              }
              // TODO: http(s)://のURL形式には未対応（必要になったら実装）
            }
          }
        } else if (typeof part === 'string') {
          // 配列の要素が文字列の場合
          texts.push(part);
        }
      }

      const result: { role: string; content: string; images?: string[] } = {
        role,
        content: texts.join('\n'),
      };

      if (images.length > 0) {
        result.images = images;
      }

      return result;
    }

    // その他の場合は文字列化
    return { role, content: String(content) };
  }

  /**
   * LLM を呼び出す
   *
   * Gemini の AIMessage 形式に合わせて usage_metadata を追加することで、
   * llm-cli などで統一的にトークン数を取得できるようにする
   */
  async invoke(messages: BaseLanguageModelInput) {
    // LangChain の入力形式を ollama の形式に変換
    const ollamaMessages = this.convertToOllamaMessages(messages);

    const response = await ollama.chat({
      model: this.model,
      messages: ollamaMessages,
      ...(this.baseUrl && { host: this.baseUrl }),
    });

    // Ollama のトークン数情報を Gemini 形式の usage_metadata にマッピング
    // 注意: 画像を含む場合、Ollama は prompt_eval_count に画像トークンも含めて返す可能性がある
    return {
      ...response.message,
      usage_metadata: {
        input_tokens: response.prompt_eval_count ?? 0,
        output_tokens: response.eval_count ?? 0,
        total_tokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      },
    };
  }
}
