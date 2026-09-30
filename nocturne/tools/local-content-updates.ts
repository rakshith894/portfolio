import type { Plugin } from 'vite';

/** Editors apply responses to the live scene; a React refresh would reset the walk. */
export function localContentUpdates(): Plugin {
  return {
    name: 'nocturne-local-content-updates',
    apply: 'serve',
    hotUpdate: {
      order: 'pre',
      handler({ file, modules, timestamp }) {
        if (!/\/content\/(skills|profile|hall-projects)\.json$/.test(file.replaceAll('\\', '/'))) return;
        const invalidated = new Set<typeof modules[number]>();
        for (const node of modules) this.environment.moduleGraph.invalidateModule(node, invalidated, timestamp);
        // Refreshing the page still reads the latest JSON, without interrupting an edit.
        return [];
      },
    },
  };
}
