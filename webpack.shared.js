const path = require("path");

const pkg = require(path.resolve(__dirname, "package.json"));

const defaultSingletons = [
  "react",
  "react-dom",
  "@auth0/auth0-react",
  "framer-motion",
  "lucide-react",
  "@radix-ui/react-slot",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
];

function resolveInstalledVersion(name) {
  try {
    const pkgJsonPath = require.resolve(`${name}/package.json`, {
      paths: [__dirname],
    });
    return require(pkgJsonPath).version;
  } catch (_error) {
    return undefined;
  }
}

const createSharedConfig = () => {
  const shared = {};

  const addShared = (name) => {
    const declaredVersion = pkg.dependencies?.[name];
    if (!declaredVersion) return;
    const installedVersion = resolveInstalledVersion(name);

    shared[name] = {
      singleton: true,
      requiredVersion: ["react", "react-dom"].includes(name)
        ? false
        : declaredVersion,
      ...(installedVersion ? { version: installedVersion } : {}),
      eager: ["react", "react-dom"].includes(name),
    };
  };

  defaultSingletons.forEach(addShared);

  return shared;
};

const resolveWorkspaceAliases = {
  "@skillevate/theme": path.resolve(__dirname, "packages/theme/src"),
  "@skillevate/main-story": path.resolve(__dirname, "packages/main-story/src"),
};

module.exports = {
  createSharedConfig,
  resolveWorkspaceAliases,
};
