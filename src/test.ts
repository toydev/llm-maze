// src/test.ts
// LLM動作確認用の超シンプルな1問1答スクリプト

import { defineCommand, runMain } from 'citty';

import LLM from '@/llm/LLM';

const main = defineCommand({
  meta: {
    name: 'test',
    description: 'LLMの動作確認用シンプルテスト',
  },
  args: {
    model: {
      type: 'positional',
      required: true,
      description: 'LLMモデル名 (例: gemini:gemini-2.5-flash, ollama:gemma3:latest)',
    },
  },
  async run({ args }) {
    const { model } = args;

    console.log(`Model: ${model}`);
    console.log('---');

    const llm = LLM.get(model);
    if (!llm) {
      console.error(`Failed to get LLM instance for model: ${model}`);
      process.exit(1);
    }

    const question = '1 + 1 = ?';
    console.log(`Q: ${question}`);

    const response = await llm.invoke(question);
    console.log(`A: ${response.content}`);
  },
});

runMain(main);
