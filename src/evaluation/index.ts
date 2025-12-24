import fs from 'fs/promises';
import path from 'path';

import yaml from 'yaml';

import { Position } from '@/maze/types';
import { Move } from '@/prompt/promptTemplate';

export type PositionResult = {
  position: Position;
  isCorrect: boolean;
  llmMove: Move | null;
  validMoves: Move[];
  timeMs?: number;
};

export type EvaluationResult = {
  mazeFile: string;
  modelName: string;
  strategyName: string;
  totalPositions: number;
  correctMoves: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimePerPositionMs: number;
  results: PositionResult[];
};

const OUTPUT_DIR = './output';

async function findYamlFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(await findYamlFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return files;
}

export async function saveResult(result: EvaluationResult): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const modelId = result.modelName.replace(/[:/]/g, '_');
  const mazeName = path.basename(result.mazeFile, '.txt');
  const outputDir = path.join(OUTPUT_DIR, modelId, result.strategyName, mazeName);
  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `${timestamp}.yaml`);
  await fs.writeFile(filePath, yaml.stringify(result));
  return filePath;
}

export async function loadResults(): Promise<EvaluationResult[]> {
  const yamlFiles = await findYamlFiles(OUTPUT_DIR);
  const results: EvaluationResult[] = [];

  for (const file of yamlFiles) {
    const content = await fs.readFile(file, 'utf-8');
    results.push(yaml.parse(content) as EvaluationResult);
  }
  return results;
}
