const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(__dirname, { annotateReactComponents: true });
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: "./global.css" });
