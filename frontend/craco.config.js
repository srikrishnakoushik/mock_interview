
const path = require('path');

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === 'true',
};

module.exports = {
  webpack: {
    // Configure aliases for easier imports (e.g., import MyComponent from '@/components/MyComponent')
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // Customize Webpack configuration
    configure: (webpackConfig, { env, paths }) => {
      // --- START: Hot Reload Configuration ---
      // This section disables hot reload if the DISABLE_HOT_RELOAD environment variable is set.
      // Useful for specific deployment scenarios, but generally enabled for development.
      if (config.disableHotReload) {
        // Remove hot reload related plugins like HotModuleReplacementPlugin
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          return !(plugin.constructor.name === 'HotModuleReplacementPlugin');
        });
        
        // Disable Webpack's watch mode
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // Ignore all files for watching
        };
      } else {
        // Optimize watch options to ignore common directories, improving build performance.
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**', // Ignore all node_modules
            '**/.git/**',         // Ignore Git repository files
            '**/build/**',        // Ignore build output directory
            '**/dist/**',         // Ignore distribution output directory
            '**/coverage/**',     // Ignore test coverage reports
            '**/public/**',       // Ignore public assets directory
          ],
        };
      }
      // --- END: Hot Reload Configuration ---

      // --- START: Fix for MediaPipe Source Map Warning ---
      // This section specifically configures source-map-loader to ignore
      // the @mediapipe/tasks-vision module, which often causes "Failed to parse source map" warnings.
      // It finds the existing source-map-loader rule and adds the exclusion,
      // or adds a new rule if one isn't found.
      webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
        // Check if the rule is for source-map-loader
        if (rule.use && Array.isArray(rule.use) && rule.use.some(useItem => typeof useItem === 'string' ? useItem.includes('source-map-loader') : useItem.loader?.includes('source-map-loader'))) {
          let newExclude = rule.exclude || [];
          if (!Array.isArray(newExclude)) {
            newExclude = [newExclude]; // Ensure exclude is an array
          }
          // Add the @mediapipe module to the exclusion list
          newExclude.push(/node_modules\/@mediapipe\/tasks-vision/);
          return { ...rule, exclude: newExclude };
        }
        return rule;
      });

      // Fallback: Ensure a source-map-loader rule with the exclusion is present
      // in case the default CRA rule structure changes or isn't found.
      const hasSourceMapLoaderRuleForMediapipe = webpackConfig.module.rules.some(rule =>
        rule.enforce === 'pre' && // source-map-loader typically runs as a pre-loader
        rule.use && Array.isArray(rule.use) && rule.use.some(useItem => typeof useItem === 'string' ? useItem.includes('source-map-loader') : useItem.loader?.includes('source-map-loader')) &&
        (Array.isArray(rule.exclude) ? rule.exclude.some(ex => ex.toString().includes('tasks-vision')) : rule.exclude && rule.exclude.toString().includes('tasks-vision'))
      );

      if (!hasSourceMapLoaderRuleForMediapipe) {
        webpackConfig.module.rules.push({
          test: /\.m?js$/, // Apply to JavaScript files
          enforce: 'pre',  // Run before other loaders
          use: ['source-map-loader'],
          exclude: /node_modules\/@mediapipe\/tasks-vision/, // Exclude the problematic module
        });
      }
      // --- END: Fix for MediaPipe Source Map Warning ---

      return webpackConfig;
    },
  },
  // --- START: Webpack Dev Server Configuration ---
  // This section explicitly configures the WebSocket URL for Webpack Dev Server's
  // Hot Module Replacement (HMR) to prevent "WebSocket connection to 'ws://localhost:443/ws' failed" errors.
  devServer: {
    client: {
      webSocketURL: {
        hostname: 'localhost', // Ensure it connects to localhost
        protocol: 'ws',        // Force non-secure WebSocket (http://)
        port: process.env.PORT || 3000, // Use the actual port your frontend is running on (e.g., 3000 or 3001)
      },
    },
    // Ensure HTTPS is not forced here unless you have a proper SSL setup for development.
    // If you had `https: true` and no certs, it would cause issues.
    // https: false, // You can explicitly set this to false if needed, or omit if not present.
  },
  // --- END: Webpack Dev Server Configuration ---
};
