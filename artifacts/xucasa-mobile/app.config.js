module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey && process.env.EAS_BUILD) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY is required for Android map builds.');
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};