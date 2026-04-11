const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve imports from ../shared/
const sharedDir = path.resolve(__dirname, '../shared');
config.watchFolders = [...(config.watchFolders || []), sharedDir];

module.exports = withNativeWind(config, { input: './global.css' });
