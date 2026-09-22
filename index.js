/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import WidgetEntry from './src/widget/WidgetEntry';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.registerComponent('HealthEntryWidget', () => WidgetEntry);
