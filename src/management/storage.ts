/** Filesystem safeguards shared by config and credential mutations. */
import {
  closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync,
  renameSync, rmdirSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface FileChange {
  path: string;
  /** null removes exactly this file. */
  data: string | null;
  mode?: number;
  /** Creation must never silently replace an existing file. */
  createOnly?: boolean;
}

export function fileStat(path: string) {
  try { return lstatSync(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function validatePathSegment(value: string, label = '名稱'): void {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()
    || value === '.' || value === '..' || /[\\/:*?"<>|\x00-\x1f\x7f]/u.test(value)
    || /[. ]$/.test(value) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(value)
    || ['__proto__', 'prototype', 'constructor'].includes(value)) {
    throw new Error(`${label}必須是安全的單一名稱，不可包含路徑或保留名稱`);
  }
}

/** Reject symlinks (including dangling links) before any read or write. */
export function assertSafePath(root: string, target: string): void {
  const base = resolve(root);
  const full = resolve(target);
  const rel = relative(base, full);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('路徑超出管理範圍');
  const volume = parse(full).root;
  let current = volume;
  for (const part of full.slice(volume.length).split(sep).filter(Boolean)) {
    current = resolve(current, part);
    const stat = fileStat(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw new Error('管理路徑不可包含符號連結');
    if (current !== full && !stat.isDirectory()) throw new Error('管理路徑的父層不是資料夾');
  }
  if (fileStat(base) && fileStat(full)) {
    const realRel = relative(realpathSync(base), realpathSync(full));
    if (isAbsolute(realRel) || realRel === '..' || realRel.startsWith(`..${sep}`)) throw new Error('實際路徑超出管理範圍');
  }
}

const heldLocks = new Set<string>();
/** Synchronous mutations cannot overlap in-process; wx also excludes other management processes. */
export function withDataLock<T>(root: string, action: () => T): T {
  const lock = resolve(root, '.management.lock');
  if (heldLocks.has(lock)) return action();
  assertSafePath(root, lock);
  mkdirSync(resolve(root), { recursive: true });
  let fd: number;
  try { fd = openSync(lock, 'wx', 0o600); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('管理資料正在變更，請稍後再試；若先前程序意外中斷，請確認沒有管理程序後移除 .management.lock');
    throw error;
  }
  heldLocks.add(lock);
  try { return action(); } finally {
    heldLocks.delete(lock);
    closeSync(fd);
    unlinkSync(lock);
  }
}

/** Stage all files first, publish via rename, and restore originals on a commit error.
 * Each file is atomic; a machine crash between multiple renames is not a filesystem-wide transaction.
 */
export function commitFileChanges(root: string, changes: FileChange[]): void {
  const seen = new Set<string>();
  const entries = changes.map((change) => {
    const path = resolve(change.path);
    if (seen.has(path)) throw new Error('重複的檔案交易目標');
    seen.add(path);
    assertSafePath(root, path);
    const stat = fileStat(path);
    if (stat && !stat.isFile()) throw new Error('管理目標必須是一般檔案');
    if (stat && change.createOnly) throw new Error('目標設定檔已存在');
    return { ...change, path, original: stat ? readFileSync(path) : undefined,
      originalMode: stat ? stat.mode & 0o777 : undefined, staged: '', backup: '', published: false };
  });
  const createdDirs: string[] = [];
  function ensureDirectory(path: string): void {
    if (fileStat(path)) return;
    ensureDirectory(dirname(path));
    assertSafePath(root, path);
    mkdirSync(path);
    createdDirs.push(path);
  }
  function stage(path: string, data: string | Buffer, mode: number): string {
    const tmp = resolve(dirname(path), `.multi-mcp-${randomUUID()}.tmp`);
    const fd = openSync(tmp, 'wx', mode);
    try { writeFileSync(fd, data); fsyncSync(fd); } catch (error) {
      closeSync(fd); unlinkSync(tmp); throw error;
    }
    closeSync(fd);
    return tmp;
  }
  try {
    for (const entry of entries) {
      ensureDirectory(dirname(entry.path));
      if (entry.data !== null) entry.staged = stage(entry.path, entry.data, entry.mode ?? entry.originalMode ?? 0o600);
      if (entry.original) entry.backup = stage(entry.path, entry.original, entry.mode ?? entry.originalMode ?? 0o600);
    }
    // Check the snapshots again after staging to avoid knowingly overwriting external edits.
    for (const entry of entries) {
      assertSafePath(root, entry.path);
      const current = fileStat(entry.path);
      if ((!!current !== !!entry.original) || (current && (!current.isFile() || !readFileSync(entry.path).equals(entry.original!)))) {
        throw new Error('管理資料已被其他程序修改，未套用此次變更');
      }
    }
    for (const entry of entries) {
      if (entry.data === null) {
        if (entry.original) unlinkSync(entry.path);
      } else {
        renameSync(entry.staged, entry.path);
        entry.staged = '';
      }
      entry.published = true;
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const entry of [...entries].reverse()) {
      if (!entry.published) continue;
      try {
        assertSafePath(root, entry.path);
        if (entry.backup) { renameSync(entry.backup, entry.path); entry.backup = ''; }
        else if (fileStat(entry.path)) unlinkSync(entry.path);
      } catch { rollbackFailed = true; }
    }
    if (rollbackFailed) {
      // Leave remaining backup files in place for recovery, without logging any contents.
      for (const entry of entries) entry.backup = '';
      throw new Error('檔案寫入失敗且無法完整還原；原始備份保留在 .multi-mcp-*.tmp，請先復原再重試');
    }
    throw error;
  } finally {
    for (const entry of entries) {
      for (const tmp of [entry.staged, entry.backup]) if (tmp && fileStat(tmp)) unlinkSync(tmp);
    }
    for (const dir of createdDirs.reverse()) removeEmptyDirectory(dir);
  }
}

export function removeEmptyDirectory(path: string): void {
  try { rmdirSync(path); } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
  }
}
