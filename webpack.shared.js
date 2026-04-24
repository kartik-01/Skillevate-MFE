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

const createSharedConfig = () => {
  const shared = {};

  const addShared = (name) => {
    if (!pkg.dependencies?.[name]) return;
    shared[name] = {
      singleton: true,
      requiredVersion: pkg.dependencies[name],
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
