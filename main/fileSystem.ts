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

/**
 * Recursively list all files in a directory
 */
function listFilesRecursively(dirPath: string, basePath: string = ''): string[] {
  const result: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        result.push(...listFilesRecursively(path.join(dirPath, entry.name), relativePath));
      } else {
        result.push(relativePath);
      }
    }
  } catch {
    // Directory not accessible
  }
  return result;
}

export function getGitChangedFilesSplit(folderPath: string): GitFileChange[] {
  try {
    const out = execSync('git status --porcelain', { cwd: folderPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log('[getGitChangedFilesSplit] Raw git status output:');
    console.log(JSON.stringify(out)); // Show exact string with escapes
    const result: GitFileChange[] = [];
    // Split by newlines and also handle \r\n for Windows
    // IMPORTANT: Don't use trim() on the full output as it removes leading spaces from the first line
    // which are significant in porcelain format (space = not staged)
    const lines = out.replace(/\r/g, '').split('\n').filter(line => line.length > 0);
    console.log(`[getGitChangedFilesSplit] Number of lines: ${lines.length}`);
    for (const line of lines) {
      // git status --porcelain format: XY filename
      // X = index status (staged), Y = working tree status (unstaged)
      // Position 0: X, Position 1: Y, Position 2: space, Position 3+: filename
      // But we need to be robust - check for malformed lines
      if (line.length < 4) {
        console.log(`[getGitChangedFilesSplit] Skipping short line (len=${line.length}): "${line}"`);
        continue;
      }
      
      // Log character codes for debugging
      console.log(`[getGitChangedFilesSplit] Line chars: [${line.charCodeAt(0)}, ${line.charCodeAt(1)}, ${line.charCodeAt(2)}] = "${line.substring(0,3)}" | rest: "${line.substring(3)}"`);
      
      // Check if line has the expected format (char, char, space, filename)
      // If position 2 is not a space, this might be malformed output from another git command
      if (line[2] !== ' ') {
        console.log(`[getGitChangedFilesSplit] Skipping non-porcelain line (pos2='${line[2]}' code=${line.charCodeAt(2)}): "${line}"`);
        continue;
      }
      
      const indexStatus = line[0];   // staged column
      const wtStatus = line[1];      // working tree column
      let file = line.substring(3);
      console.log(`[getGitChangedFilesSplit] Line: "${line}" | indexStatus: "${indexStatus}" | wtStatus: "${wtStatus}" | file: "${file}"`);

      // Staged change (index column has a letter, not space or ?)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        console.log(`[getGitChangedFilesSplit] Adding staged: ${file} (status: ${indexStatus})`);
        result.push({ file, status: indexStatus, staged: true });
      }
      // Unstaged / working tree change
      if (wtStatus !== ' ' && wtStatus !== undefined) {
        // Untracked files show as '??' — only add once as unstaged
        if (indexStatus === '?') {
          // Check if this is a directory (ends with /) - expand it to individual files
          if (file.endsWith('/')) {
            const dirPath = path.join(folderPath, file);
            const filesInDir = listFilesRecursively(dirPath);
            console.log(`[getGitChangedFilesSplit] Expanding untracked directory: ${file} -> ${filesInDir.length} files`);
            for (const subFile of filesInDir) {
              const fullRelPath = file + subFile;
              console.log(`[getGitChangedFilesSplit] Adding untracked file from dir: ${fullRelPath}`);
              result.push({ file: fullRelPath, status: '??', staged: false });
            }
          } else {
            console.log(`[getGitChangedFilesSplit] Adding untracked: ${file}`);
            result.push({ file, status: '??', staged: false });
          }
        } else {
          console.log(`[getGitChangedFilesSplit] Adding unstaged: ${file} (status: ${wtStatus})`);
          result.push({ file, status: wtStatus, staged: false });
        }
      }
    }
    console.log('[getGitChangedFilesSplit] Final result:', JSON.stringify(result, null, 2));
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
  console.log('[gitStageAll] Staging all files in:', folderPath);
  execSync('git add -A', { cwd: folderPath });
  console.log('[gitStageAll] Done');
}

export function gitUnstageAll(folderPath: string): void {
  console.log('[gitUnstageAll] Unstaging all files in:', folderPath);
  try {
    // First, check if we have any commits (HEAD exists)
    try {
      execSync('git rev-parse HEAD', { cwd: folderPath, stdio: ['pipe', 'pipe', 'pipe'] });
      // HEAD exists, use git reset
      execSync('git reset HEAD --quiet', { cwd: folderPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      // No commits yet, use git rm --cached for all staged files
      execSync('git rm --cached -r . --quiet 2>/dev/null || true', { cwd: folderPath, encoding: 'utf-8', shell: '/bin/bash' });
    }
    // Wait a tiny bit for git index to be fully written
    execSync('sleep 0.05', { cwd: folderPath });
    console.log('[gitUnstageAll] Done');
  } catch (err) {
    console.error('[gitUnstageAll] Error:', err);
  }
}

export function gitDiscardFile(folderPath: string, filePath: string): { success: boolean; error?: string } {
  const rel = path.relative(folderPath, filePath.startsWith('/') ? filePath : path.join(folderPath, filePath));
  try {
    // Check if file is untracked
    const status = execSync(`git status --porcelain -- "${rel}"`, { cwd: folderPath, encoding: 'utf-8' }).trim();
    if (status.startsWith('??')) {
      // Untracked file - just delete it
      const fullPath = path.join(folderPath, rel);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } else {
      // Tracked file - checkout from HEAD
      execSync(`git checkout HEAD -- "${rel}"`, { cwd: folderPath });
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
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
