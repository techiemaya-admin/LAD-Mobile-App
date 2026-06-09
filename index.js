import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// Manual entry with full context support enabled via metro.config.js
export function App() {
  // @ts-ignore: require.context is a Metro feature
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
