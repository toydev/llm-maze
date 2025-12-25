import fs from 'fs/promises';
import path from 'path';

import yaml from 'yaml';

import type { Evaluation } from '@/evaluation/result';

const OUTPUT_DIR = './output';

export type EvaluationFilter = {
  model?: string;
  maze?: string;
  strategy?: string;
};

export class Evaluations {
  static async all(): Promise<Evaluation[]> {
    const yamlFiles = await findYamlFiles(OUTPUT_DIR);
    const evaluations: Evaluation[] = [];
    for (const file of yamlFiles) {
      const content = await fs.readFile(file, 'utf-8');
      evaluations.push(yaml.parse(content) as Evaluation);
    }
    return evaluations;
  }

  static async find(filter: EvaluationFilter): Promise<Evaluation[]> {
    let evaluations = await this.all();

    if (filter.model && filter.model.toLowerCase() !== 'all') {
      evaluations = evaluations.filter((e) => e.modelName.includes(filter.model!));
    }
    if (filter.maze && filter.maze.toLowerCase() !== 'all') {
      evaluations = evaluations.filter((e) => e.mazeFile.includes(filter.maze!));
    }
    if (filter.strategy && filter.strategy.toLowerCase() !== 'all') {
      evaluations = evaluations.filter((e) => e.strategyName === filter.strategy);
    }

    return evaluations;
  }

  static async save(evaluation: Evaluation): Promise<string> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const modelId = evaluation.modelName.replace(/[:/]/g, '_');
    const mazeName = path.basename(evaluation.mazeFile, '.txt');
    const outputDir = path.join(OUTPUT_DIR, modelId, evaluation.strategyName, mazeName);
    await fs.mkdir(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${timestamp}.yaml`);
    await fs.writeFile(filePath, yaml.stringify(evaluation));
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
