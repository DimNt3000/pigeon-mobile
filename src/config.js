import { Platform } from 'react-native';

// Address of the PC running the Pigeon server (dev/socketio-chat, `npm start`).
// 192.168.1.19 was this PC's WiFi address when the app was generated; if it
// changes (check with `ipconfig`), edit it here or on the join screen.
export const DEFAULT_SERVER_URL = Platform.OS === 'web'
  ? 'http://localhost:3000'
  : 'http://192.168.1.19:3000';
