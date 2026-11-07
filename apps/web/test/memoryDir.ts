import type { DirLike } from '../src/lib/folder.ts';

export type MemDir = DirLike & { files: Map<string, Blob>; dirs: Map<string, MemDir>; permission: PermissionState };

/** In-memory stand-in for a FileSystemDirectoryHandle. */
export const memoryDir = (name = 'will-music'): MemDir => {
  const files = new Map<string, Blob>();
  const dirs = new Map<string, MemDir>();
  const dir: MemDir = {
    kind: 'directory',
    name,
    files,
    dirs,
    permission: 'granted',
    async getDirectoryHandle(child, opts) {
      if (!dirs.has(child)) {
        if (!opts?.create) throw new DOMException('not found', 'NotFoundError');
        dirs.set(child, memoryDir(child));
      }
      return dirs.get(child)!;
    },
    async getFileHandle(child, opts) {
      if (!files.has(child) && !opts?.create) throw new DOMException('not found', 'NotFoundError');
      return {
        kind: 'file',
        name: child,
        getFile: async () => new File([files.get(child) ?? new Blob([])], child),
        createWritable: async () => {
          const parts: BlobPart[] = [];
          return { write: async (data: BlobPart) => void parts.push(data), close: async () => void files.set(child, new Blob(parts)) };
        },
      };
    },
    async removeEntry(child) {
      if (!files.delete(child) && !dirs.delete(child)) throw new DOMException('not found', 'NotFoundError');
    },
    async *values() {
      for (const d of dirs.values()) yield d;
      for (const f of [...files.keys()]) yield await dir.getFileHandle(f);
    },
    queryPermission: async () => dir.permission,
    requestPermission: async () => (dir.permission = 'granted'),
  };
  return dir;
};

export const allFiles = (dir: MemDir, prefix = ''): string[] => [
  ...[...dir.files.keys()].map((f) => prefix + f),
  ...[...dir.dirs.entries()].flatMap(([n, d]) => allFiles(d, `${prefix}${n}/`)),
];
