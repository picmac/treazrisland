import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import reactHooks from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
});

if (!reactHooks.rules?.["incompatible-library"]) {
  if (!reactHooks.rules) {
    reactHooks.rules = {};
  }

  reactHooks.rules["incompatible-library"] = {
    meta: {
      docs: {
        description:
          "Temporary stub to avoid lint crashes when react-hooks/incompatible-library is not bundled",
      },
      schema: [],
    },
    create: () => ({}),
  };
}

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    name: "treazrisland/temporary-eslint-rule-stubs",
    plugins: {
      "@typescript-eslint": {
        rules: {
          "no-dynamic-delete": {
            meta: {
              docs: {
                description:
                  "Temporary stub to avoid lint crashes when @typescript-eslint/no-dynamic-delete is not bundled",
              },
              schema: [],
            },
            create: () => ({}),
          },
        },
      },
    },
    rules: {
      "@typescript-eslint/no-dynamic-delete": "off",
    },
  },
];

export default config;
