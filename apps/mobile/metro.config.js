/**
 * Metro, taught about the workspace.
 *
 * Two things break by default in a pnpm monorepo, and both fail in ways that look
 * like a broken import rather than a broken bundler:
 *
 *   `watchFolders` — Metro only watches the project directory, so an edit to
 *   packages/shared does not trigger a reload and, worse, the file cannot be
 *   resolved at all because it lives outside the watched tree.
 *
 *   `nodeModulesPaths` — pnpm puts most packages in a store and symlinks them.
 *   Metro has to be told to look in the workspace root's node_modules as well as
 *   this app's, or every hoisted dependency resolves to nothing.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/**
 * Hierarchical lookup stays ON, which is the opposite of the usual monorepo advice.
 *
 * Turning it off is correct for npm and Yarn, where everything is hoisted into one
 * flat node_modules and walking up the tree only finds duplicates. pnpm does not
 * hoist: a package's own dependencies live in symlinks inside its own directory, so
 * `expo-modules-core` reaches `invariant` by walking up from where it sits in the
 * store. Disabling that walk makes every transitive dependency unresolvable —
 * `Unable to resolve "invariant"` from a file nobody in this repo wrote.
 *
 * Duplicate-instance risk is handled by pnpm itself instead, which gives one physical
 * copy per version, plus the hoist patterns in pnpm-workspace.yaml for the packages
 * React Native insists on seeing flat.
 */

// `@nbss/shared` ships TypeScript source rather than a built dist, so that the web
// app and this one bundle the same files. Metro handles .ts natively; what it needs
// is permission to follow the symlink into it, which `unstable_enableSymlinks` gives.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
