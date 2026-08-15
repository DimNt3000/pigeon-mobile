# Pigeon Mobile

React Native (Expo) client for the Pigeon chat server that lives in
`../socketio-chat`. Same features as the web client: join a room with a name,
real-time messages, room switching from the header modal, online list, typing
indicator, join and leave notices, automatic reconnect that replays missed
messages.

## Stack

- Expo SDK 57, React Native 0.86, plain JavaScript
- socket.io-client 4 with `transports: ['websocket']` (no CORS setup needed on
  the server, and no long-polling quirks in React Native)
- react-native-safe-area-context for notch and gesture insets
- No Intl usage: timestamps are formatted manually because Hermes ships
  partial Intl support

## Getting started

1. Start the chat server on the PC:

   ```
   cd ../socketio-chat
   npm start
   ```

2. Start Metro and scan the QR code with Expo Go (phone and PC on the same WiFi):

   ```
   npx expo start
   ```

3. In the app, check the server address on the join screen. It defaults to
   `http://192.168.1.19:3000` (this PC's WiFi address when the project was
   generated). If your PC's address changed, run `ipconfig` and update the
   field, or change `DEFAULT_SERVER_URL` in `src/config.js`.

## Testing in a desktop browser

The same code runs on the web through react-native-web:

```
npx expo start
```

Then open http://localhost:8081. On web the server address defaults to
`http://localhost:3000`.

## Troubleshooting

- "Could not reach the server": confirm the server is running, the phone is on
  the same WiFi, and the address matches the PC's current `ipconfig` IPv4.
- If the address is right and it still fails, Windows Firewall is probably
  blocking inbound connections to Node.js. Allow Node.js for private networks
  in Windows Security, then retry.
- Expo Go only runs projects on its own SDK version. If the project does not
  load, update the Expo Go app on the phone.

## Structure

```
App.js              Socket lifecycle, chat state, screen switching
src/config.js       Default server URL per platform
src/theme.js        Colors and fonts shared by both screens
src/JoinScreen.js   Name and server address form
src/ChatScreen.js   Inverted message list, typing line, composer, users modal
```
