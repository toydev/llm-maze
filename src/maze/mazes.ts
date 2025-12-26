import fs from 'fs/promises';
import path from 'path';

const DIR = './mazes';

export class Mazes {
  static async all(): Promise<string[]> {
    const files = await fs.readdir(DIR);
    const mazeFiles = files.filter((file) => file.endsWith('.txt')).map((file) => path.join(DIR, file));
    if (mazeFiles.length === 0) {
      throw new Error('No maze files found');
    }
    return mazeFiles;
  }

  static async find(pattern?: string): Promise<string[]> {
    const all = await this.all();
    if (!pattern) return all;
    const matched = all.filter((file) => file.includes(pattern));
    if (matched.length === 0) {
      throw new Error(`No maze files found matching: ${pattern}`);
    }
    return matched;
  }
}
