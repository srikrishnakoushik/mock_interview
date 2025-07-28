// craco.config.js
const path = require('path');

const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === 'true',
};

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env, paths }) => {
      // ... (Your existing hot reload and source map exclusion logic) ...

      return webpackConfig;
    },
  },
  devServer: { // ADD THIS SECTION FOR DEV SERVER CONFIG
    client: {
      webSocketURL: {
        // This forces the WebSocket to connect to the correct protocol and port
        hostname: 'localhost',
        protocol: 'ws', // Force WebSocket (not secure)
        port: process.env.PORT || 3000, // Use your app's actual port (e.g., 3000 or 3001)
      },
    },
    // Ensure you don't have https: true here unless you have a proper SSL setup
    // https: false, // If present, ensure this is false for development if you're not using HTTPS
  },
};