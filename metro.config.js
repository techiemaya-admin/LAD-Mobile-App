const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, 'app');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Enable package exports and context modules for virtual routing
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_enableContextModule = true;

// Handle @/ alias manually
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, moduleName.replace('@/', './')),
      platform
    );
  }
  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Ensure we handle ESM and CJS correctly
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
