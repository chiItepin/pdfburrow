type FieldNameNode = {
  terminal: boolean;
  children: Map<string, FieldNameNode>;
};

const createNode = (): FieldNameNode => ({ terminal: false, children: new Map() });

export const createPdfFieldNames = () => {
  const root = createNode();
  const suffixes = new Map<string, number>();
  const conflicts = (name: string) => {
    let node = root;
    for (const part of name.split(".")) {
      if (node.terminal) {
        return true;
      }
      const child = node.children.get(part);
      if (!child) {
        return false;
      }
      node = child;
    }
    return node.terminal || node.children.size > 0;
  };
  const add = (name: string) => {
    let node = root;
    for (const part of name.split(".")) {
      let child = node.children.get(part);
      if (!child) {
        child = createNode();
        node.children.set(part, child);
      }
      node = child;
    }
    node.terminal = true;
  };
  return {
    add,
    conflicts,
    available: (original: string) => {
      let name = original;
      if (conflicts(name)) {
        const [first, ...rest] = original.split(".");
        let suffix = suffixes.get(original) ?? 2;
        do {
          name = [`${first}_${suffix++}`, ...rest].join(".");
        } while (conflicts(name));
        suffixes.set(original, suffix);
      }
      add(name);
      return name;
    },
  };
};
