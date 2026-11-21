// React Native's index requires each component lazily, the first time the app reads it (a getter
// per export). In a test that happens inside the first render, so on a cold transform cache (a
// fresh checkout, CI, `--no-cache`) transforming ScrollView, Animated, Switch and the rest took
// over 5 s inside whichever test first rendered them, past jest's timeout, though the test itself
// takes milliseconds. Loading them here, before the tests start (setup files have no timeout),
// keeps that cost out of every test. Add a component here when the app starts using one.
import * as ReactNative from 'react-native';

const USED_BY_THE_APP = [
  'ActivityIndicator',
  'FlatList',
  'Modal',
  'Pressable',
  'ScrollView',
  'Switch',
  'Text',
  'View',
] as const;

for (const name of USED_BY_THE_APP) void ReactNative[name];
