import fs from 'fs/promises';
import path from 'path';

import yaml from 'yaml';
import { z } from 'zod';

import type { Direction, Position } from '@/maze/maze';

export const MOVES = ['up', 'down', 'left', 'right'] as const;
export type Move = (typeof MOVES)[number];

export const MoveActionSchema = z.object({
  move: z.enum(MOVES),
});
export type MoveAction = z.infer<typeof MoveActionSchema>;

export function directionToMove(direction: Direction): Move {
  if (direction.dx === 0 && direction.dy === -1) return 'up';
  if (direction.dx === 0 && direction.dy === 1) return 'down';
  if (direction.dx === -1 && direction.dy === 0) return 'left';
  if (direction.dx === 1 && direction.dy === 0) return 'right';
  throw new Error(`Invalid direction: ${JSON.stringify(direction)}`);
}

export type CellResult = {
  position: Position;
  isCorrect: boolean;
  llmMove: Move | null;
  correctMoves: Move[];
  timeMs?: number;
};

export type Execution = {
  mazeFile: string;
  modelName: string;
  strategyName: string;
  cellResults: CellResult[];
};

export type ExecutionFilter = {
  model?: string;
  maze?: string;
  strategy?: string;
};

const EXECUTIONS_DIR = './output/executions';

export class Executions {
  static async all(): Promise<Execution[]> {
    const yamlFiles = await findYamlFiles(EXECUTIONS_DIR);
    const executions: Execution[] = [];
    for (const file of yamlFiles) {
      const content = await fs.readFile(file, 'utf-8');
      executions.push(yaml.parse(content) as Execution);
    }
    return executions;
  }

  static async find(filter: ExecutionFilter): Promise<Execution[]> {
    let executions = await this.all();

    if (filter.model) {
      executions = executions.filter((e) => e.modelName.includes(filter.model!));
    }
    if (filter.maze) {
      executions = executions.filter((e) => e.mazeFile.includes(filter.maze!));
    }
    if (filter.strategy) {
      executions = executions.filter((e) => e.strategyName === filter.strategy);
    }

    return executions;
  }

  static async save(execution: Execution): Promise<string> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const modelId = execution.modelName.replace(/[:/]/g, '_');
    const mazeName = path.basename(execution.mazeFile, '.txt');
    const outputDir = path.join(EXECUTIONS_DIR, modelId, execution.strategyName, mazeName);
    await fs.mkdir(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${timestamp}.yaml`);
    await fs.writeFile(filePath, yaml.stringify(execution));
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
