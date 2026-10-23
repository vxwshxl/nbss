/**
 * Writes the Google Maps key into AndroidManifest.xml, which is all
 * react-native-maps needs on Android.
 *
 * react-native-maps ships its own config plugin, but from SDK 58 it imports an
 * internal path of @expo/config-plugins that no longer exists, and the whole
 * config fails to load. This does the one thing we used it for, through the
 * public API. iOS uses Apple Maps (PROVIDER_DEFAULT), so it needs no key.
 */
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

module.exports = function withAndroidMapsKey(config, { apiKey } = {}) {
  if (!apiKey) return config;
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, "com.google.android.geo.API_KEY", apiKey);
    return mod;
  });
};
