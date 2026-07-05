import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  {
    ignores: ["main.js", "node_modules/", "esbuild.config.mjs", "eslint.config.mjs"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          // Vestaboard is a trademark; Local/Cloud are the two named
          // transports (Vestaboard's "Local API" and cloud Read/Write API).
          brands: ["Vestaboard", "Local", "Cloud"],
          acronyms: ["LAN", "API"],
          ignoreRegex: ["Read/Write"],
        },
      ],
    },
  },
  {
    // tileGrid renders through parent.ownerDocument (popout-safe) but uses
    // bare createElement so the pure renderer stays unit-testable in jsdom,
    // where Obsidian's createDiv/createEl DOM augmentations don't exist.
    files: ["src/obsidian/tileGrid.ts", "tests/**/*.ts"],
    rules: {
      "obsidianmd/prefer-create-el": "off",
    },
  },
  {
    // The declarative settings API (getSettingDefinitions) requires Obsidian
    // 1.13+; we declare minAppVersion 1.7.2. Revisit when bumping it.
    files: ["src/obsidian/settings.ts"],
    rules: {
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
  {
    // Tests drive async internals directly with vitest fake timers.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
);
