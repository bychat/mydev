import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeEntry[];
}

const SKIP_DIRS = ['node_modules', '__pycache__', '.git'];

export function readDirectoryTree(dirPath: string): TreeEntry[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(e => !SKIP_DIRS.includes(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return { name: entry.name, path: fullPath, type: 'folder' as const, children: readDirectoryTree(fullPath) };
      }
      return { name: entry.name, path: fullPath, type: 'file' as const };
    });
}

export interface GitFileChange {
  file: string;
  status: string;
  staged: boolean;
}

export function getGitChangedFiles(folderPath: string): { file: string; status: string }[] {
  try {
    const out = execSync('git status --porcelain', { cwd: folderPath, encoding: 'utf-8' });
    return out.trim().split('\n').filter(Boolean).map(line => ({
      status: line.substring(0, 2).trim(),
      file: line.substring(3),
    }));
  } catch {
    return [];
  }
}

export function getGitChangedFilesSplit(folderPath: string): GitFileChange[] {
  try {
    const out = execSync('git status --porcelain', { cwd: folderPath, encoding: 'utf-8' });
    const result: GitFileChange[] = [];
    for (const line of out.trim().split('\n').filter(Boolean)) {
      const indexStatus = line[0];   // staged column
      const wtStatus = line[1];      // working tree column
      const file = line.substring(3);

      // Staged change (index column has a letter, not space or ?)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        result.push({ file, status: indexStatus, staged: true });
      }
      // Unstaged / working tree change
      if (wtStatus !== ' ' && wtStatus !== undefined) {
        // Untracked files show as '??' — only add once as unstaged
        if (indexStatus === '?') {
          result.push({ file, status: '??', staged: false });
        } else {
          result.push({ file, status: wtStatus, staged: false });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function gitStageFile(folderPath: string, filePath: string): void {
  const rel = path.relative(folderPath, filePath.startsWith('/') ? filePath : path.join(folderPath, filePath));
  execSync(`git add -- "${rel}"`, { cwd: folderPath });
}

export function gitUnstageFile(folderPath: string, filePath: string): void {
  const rel = path.relative(folderPath, filePath.startsWith('/') ? filePath : path.join(folderPath, filePath));
  execSync(`git reset HEAD -- "${rel}"`, { cwd: folderPath });
}

export function gitStageAll(folderPath: string): void {
  execSync('git add -A', { cwd: folderPath });
}

export function gitUnstageAll(folderPath: string): void {
  execSync('git reset HEAD', { cwd: folderPath });
}

export function gitCommit(folderPath: string, message: string): { success: boolean; error?: string } {
  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: folderPath, encoding: 'utf-8' });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function getGitDiff(folderPath: string, filePath: string): { oldContent: string; newContent: string } {
  try {
    const rel = path.relative(folderPath, filePath);
    let oldContent = '';
    try {
      oldContent = execSync(`git show HEAD:${rel}`, { cwd: folderPath, encoding: 'utf-8' });
    } catch { /* new file */ }
    let newContent = '';
    try {
      newContent = fs.readFileSync(filePath, 'utf-8');
    } catch { /* deleted file */ }
    return { oldContent, newContent };
  } catch {
    return { oldContent: '', newContent: '' };
  }
}

export function getGitIgnoredPaths(folderPath: string): string[] {
  try {
    const out = execSync(
      'git ls-files --others --ignored --exclude-standard --directory',
      { cwd: folderPath, encoding: 'utf-8' }
    );
    return out.trim().split('\n').filter(Boolean).map(f => path.join(folderPath, f.replace(/\/$/, '')));
  } catch {
    return [];
  }
}
