export const createFileRegistry = () => {
  const files = new Map<string, File>();
  return {
    get: (id: string) => files.get(id),
    retain: (id: string, file: File) => {
      files.set(id, file);
    },
    release: (id: string) => {
      files.delete(id);
    },
    releaseAll: () => {
      files.clear();
    },
  };
};

export type FileRegistry = ReturnType<typeof createFileRegistry>;
