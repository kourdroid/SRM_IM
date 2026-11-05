const fs = require('node:fs');

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !googleServicesFile) {
    throw new Error('Android push setup is missing GOOGLE_SERVICES_JSON in EAS.');
  }
  return { ...config, android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) } };
};
