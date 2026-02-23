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

export interface GitBranchInfo {
  current: string;
  branches: string[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

export function gitGetBranchInfo(folderPath: string): GitBranchInfo {
  const info: GitBranchInfo = { current: '', branches: [], ahead: 0, behind: 0, hasRemote: false };
  try {
    info.current = execSync('git rev-parse --abbrev-ref HEAD', { cwd: folderPath, encoding: 'utf-8' }).trim();
  } catch { return info; }

  try {
    const out = execSync('git branch --no-color', { cwd: folderPath, encoding: 'utf-8' });
    info.branches = out.trim().split('\n').map(b => b.replace(/^\*?\s+/, '').trim()).filter(Boolean);
  } catch { /* ignore */ }

  try {
    const remote = execSync('git config --get branch.' + info.current + '.remote', { cwd: folderPath, encoding: 'utf-8' }).trim();
    info.hasRemote = !!remote;
  } catch { info.hasRemote = false; }

  if (info.hasRemote) {
    try {
      const out = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: folderPath, encoding: 'utf-8' }).trim();
      const [ahead, behind] = out.split(/\s+/).map(Number);
      info.ahead = ahead || 0;
      info.behind = behind || 0;
    } catch { /* no upstream tracking */ }
  }

  return info;
}

export function gitListBranches(folderPath: string): string[] {
  try {
    const out = execSync('git branch --no-color', { cwd: folderPath, encoding: 'utf-8' });
    return out.trim().split('\n').map(b => b.replace(/^\*?\s+/, '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function gitCheckout(folderPath: string, branch: string): { success: boolean; error?: string } {
  try {
    execSync(`git checkout "${branch}"`, { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitCreateBranch(folderPath: string, branch: string): { success: boolean; error?: string } {
  try {
    execSync(`git checkout -b "${branch}"`, { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitPull(folderPath: string): { success: boolean; output?: string; error?: string } {
  try {
    const out = execSync('git pull', { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, output: out.trim() };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

export function gitPush(folderPath: string): { success: boolean; output?: string; error?: string } {
  try {
    const out = execSync('git push', { cwd: folderPath, encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, output: out.trim() };
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
