declare module '@vitejs/plugin-react' {
  type ReactPlugin = (...args: unknown[]) => any;
  const plugin: ReactPlugin;
  export default plugin;
}
