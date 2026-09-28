import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, serif } from './theme';
import { DEFAULT_ROOM } from './config';

export default function JoinScreen({ defaultServerUrl, joining, error, onJoin }) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState(DEFAULT_ROOM);
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const canJoin = name.trim().length > 0 && serverUrl.trim().length > 0 && !joining;

  function submit() {
    if (canJoin) onJoin(name, serverUrl, room);
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Padding on Android too: drawn edge to edge, the window does not
          shrink for the keyboard, which would cover the lower fields. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.wordmark}>Pigeon</Text>
            <Text style={styles.tagline}>
              A small real-time chat built with Socket.IO. Join from your phone, talk to the
              browser tabs.
            </Text>

            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={24}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.label}>Room</Text>
            <TextInput
              style={styles.input}
              value={room}
              onChangeText={setRoom}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <Text style={styles.hint}>
              general, random and dev exist by default. Any other name creates a room.
            </Text>

            <Text style={styles.label}>Server address</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Text style={styles.hint}>The PC running the Pigeon server, on the same WiFi.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canJoin}
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                !canJoin && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonText}>{joining ? 'Joining' : 'Join the chat'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 24,
  },
  wordmark: {
    fontFamily: serif,
    fontSize: 32,
    fontWeight: '700',
    color: colors.ink,
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: -8,
    marginBottom: 8,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginTop: 8,
  },
  button: {
    minHeight: 44,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  buttonPressed: {
    backgroundColor: colors.accentDark,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
});
