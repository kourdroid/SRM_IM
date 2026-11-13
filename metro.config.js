const path = require('node:path');
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(__dirname, { annotateReactComponents: true });
config.resolver.assetExts.push('wasm');

// apps/ holds the separate Vite web dashboard (own node_modules): keep it out of the mobile bundle.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const appsDir = escapeRegExp(path.resolve(__dirname, 'apps')).replace(/\\\\/g, '[\\\\/]');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList || []),
  new RegExp(`^${appsDir}[\\\\/].*`),
];

module.exports = withNativeWind(config, { input: "./global.css" });
