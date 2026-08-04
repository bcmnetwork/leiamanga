const { withProjectBuildGradle } = require('@expo/config-plugins');

// Some old/unmaintained native modules transitively pull the legacy (pre-AndroidX)
// com.android.support:support-compat / support-media-compat artifacts, which collide
// with androidx.core / androidx.media at package time (":app:checkReleaseDuplicateClasses").
// This excludes them project-wide so only the AndroidX versions are ever used.
const EXCLUDE_BLOCK = `
allprojects {
    configurations.all {
        exclude group: 'com.android.support', module: 'support-compat'
        exclude group: 'com.android.support', module: 'support-media-compat'
        exclude group: 'com.android.support', module: 'support-v4'
        exclude group: 'com.android.support', module: 'support-core-utils'
        exclude group: 'com.android.support', module: 'support-core-ui'
        exclude group: 'com.android.support', module: 'support-fragment'
    }
}
`;

function withAndroidExcludeLegacySupportLibrary(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      if (!config.modResults.contents.includes("exclude group: 'com.android.support'")) {
        config.modResults.contents += EXCLUDE_BLOCK;
      }
    }
    return config;
  });
}

module.exports = withAndroidExcludeLegacySupportLibrary;
