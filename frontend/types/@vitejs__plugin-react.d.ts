declare module '@vitejs/plugin-react' {
  type ReactPlugin = (...args: unknown[]) => unknown;
  const plugin: ReactPlugin;
  export default plugin;
}
