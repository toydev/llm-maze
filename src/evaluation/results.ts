import fs from 'fs/promises';
import path from 'path';

import yaml from 'yaml';

import type { EvaluationResult } from '@/evaluation/result';

const OUTPUT_DIR = './output';

export type ResultFilter = {
  model?: string;
  maze?: string;
  strategy?: string;
};

export class Results {
  static async all(): Promise<EvaluationResult[]> {
    const yamlFiles = await findYamlFiles(OUTPUT_DIR);
    const results: EvaluationResult[] = [];
    for (const file of yamlFiles) {
      const content = await fs.readFile(file, 'utf-8');
      results.push(yaml.parse(content) as EvaluationResult);
    }
    return results;
  }

  static async find(filter: ResultFilter): Promise<EvaluationResult[]> {
    let results = await this.all();

    if (filter.model && filter.model.toLowerCase() !== 'all') {
      results = results.filter((r) => r.modelName.includes(filter.model!));
    }
    if (filter.maze && filter.maze.toLowerCase() !== 'all') {
      results = results.filter((r) => r.mazeFile.includes(filter.maze!));
    }
    if (filter.strategy && filter.strategy.toLowerCase() !== 'all') {
      results = results.filter((r) => r.strategyName === filter.strategy);
    }

    return results;
  }

  static async save(result: EvaluationResult): Promise<string> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const modelId = result.modelName.replace(/[:/]/g, '_');
    const mazeName = path.basename(result.mazeFile, '.txt');
    const outputDir = path.join(OUTPUT_DIR, modelId, result.strategyName, mazeName);
    await fs.mkdir(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${timestamp}.yaml`);
    await fs.writeFile(filePath, yaml.stringify(result));
    return filePath;
  }
}

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
