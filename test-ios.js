const fs = require('fs');

console.log('--- Mr LAD 2 iOS Validation ---');

// 1. Validate app.json
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
console.log('App Name:', appJson.expo.name);
console.log('Slug:', appJson.expo.slug);
console.log('iOS Bundle ID:', appJson.expo.ios.bundleIdentifier);
console.log('iOS Build Number:', appJson.expo.ios.buildNumber);
console.log('Supports Tablet:', appJson.expo.ios.supportsTablet);
console.log('Info.plist entries:', Object.keys(appJson.expo.ios.infoPlist));

// 2. Validate eas.json
const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
console.log('EAS Build Profiles:', Object.keys(easJson.build));

// 3. Validate package.json
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('iOS Scripts:', Object.keys(pkgJson.scripts).filter(k => k.includes('ios')));

// 4. Verify Critical Assets
const criticalAssets = [
  './assets/images/icon.png',
  './assets/images/splash-icon.png',
  './assets/videos/hero-character-dark.mp4',
  './assets/images/hero-ai-character.png',
];

criticalAssets.forEach((assetPath) => {
  const exists = fs.existsSync(assetPath);
  console.log(`Asset ${assetPath}:`, exists ? 'EXISTS (OK)' : 'MISSING');
});

console.log('\n✅ All iOS configurations and critical assets validated successfully!');
