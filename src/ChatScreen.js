import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';

// Manual formatting instead of toLocaleTimeString: Hermes ships partial Intl
// support, so keep time rendering engine-independent.
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function typingText(typingUsers) {
  if (typingUsers.length === 0) return '';
  if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
  if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
  return 'Several people are typing';
}

export default function ChatScreen({
  username,
  room,
  rooms,
  connected,
  users,
  myId,
  messages,
  typingUsers,
  pending,
  onSend,
  onSwitchRoom,
  onTypingChange,
  onLeave,
}) {
  const [draft, setDraft] = useState('');
  const [showUsers, setShowUsers] = useState(false);

  function handleChange(text) {
    setDraft(text);
    onTypingChange(text.trim().length > 0);
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  function renderItem({ item }) {
    if (item.kind === 'system') {
      return (
        <Text style={styles.system}>
          {item.text} at {formatTime(item.time)}
        </Text>
      );
    }
    // Live messages carry the author's id, so a same-named stranger is never
    // mistaken for you. Messages stored before ids existed fall back to the name.
    const own = item.clientId ? item.clientId === myId : item.user === username;
    return (
      <View style={[styles.message, own && styles.messageOwn]}>
        <View style={styles.meta}>
          <Text style={[styles.name, own && styles.nameOwn]}>{item.user}</Text>
          <Text style={[styles.time, own && styles.timeOwn]}>{formatTime(item.time)}</Text>
        </View>
        <Text style={[styles.text, own && styles.textOwn]}>{item.text}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.roomTitle} numberOfLines={1}>
          {room ? `#${room}` : 'Pigeon'}
        </Text>
        <View style={styles.topbarRight}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowUsers(true)}
            style={styles.presence}
          >
            <View style={[styles.dot, !connected && styles.dotOffline]} />
            <Text style={styles.presenceText}>
              {connected ? `${users.length} online` : 'Reconnecting'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onLeave} style={styles.leave}>
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          inverted
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.empty, styles.invertFix]}>No messages yet. Say hi.</Text>
          }
        />

        {/* Queued messages matter more than who is typing, and nobody can be
            typing at us while we are offline anyway. */}
        {pending > 0 ? (
          <Text style={[styles.typing, styles.typingPending]}>
            {pending === 1 ? 'Waiting to send 1 message' : `Waiting to send ${pending} messages`}
          </Text>
        ) : (
          <Text style={styles.typing}>{typingText(typingUsers)}</Text>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={handleChange}
            placeholder="Type a message"
            placeholderTextColor={colors.muted}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleSend}
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showUsers}
        transparent
        // On web the fade is driven by a CSS animation, and the modal only
        // unmounts once `animationend` fires. Environments that never
        // composite frames leave it stuck open, so skip the animation there.
        animationType={Platform.OS === 'web' ? 'none' : 'fade'}
        onRequestClose={() => setShowUsers(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowUsers(false)}>
          <Pressable style={styles.usersPanel} onPress={() => {}}>
            {/* Rooms with recent history are listed too, so this can outgrow a
                phone screen. The panel caps its height and scrolls instead. */}
            <ScrollView>
            <Text style={styles.usersTitle}>Rooms</Text>
            {rooms.map((entry) => {
              const current = entry.name === room;
              return (
                <Pressable
                  key={entry.name}
                  accessibilityRole="button"
                  disabled={current}
                  onPress={() => {
                    setShowUsers(false);
                    onSwitchRoom(entry.name);
                  }}
                  style={[styles.roomRow, current && styles.roomRowCurrent]}
                >
                  <Text style={[styles.roomRowText, current && styles.roomRowTextCurrent]}>
                    {entry.count > 0 ? `#${entry.name} (${entry.count})` : `#${entry.name}`}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={[styles.usersTitle, styles.sectionGap]}>Online ({users.length})</Text>
            {/* One row per person, so two people sharing a name both appear and
                only the one that is actually you is marked. */}
            {users.map((person) => (
              <Text key={person.id} style={styles.userRow}>
                {person.name}
                {person.id === myId ? ' (you)' : ''}
              </Text>
            ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    flexShrink: 1,
  },
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  dotOffline: {
    backgroundColor: colors.offline,
  },
  presenceText: {
    fontSize: 14,
    color: colors.muted,
  },
  leave: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  leaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  listContent: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  invertFix: {
    transform: [{ scaleY: -1 }],
  },
  message: {
    maxWidth: '80%',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageOwn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  nameOwn: {
    color: colors.onAccentSoft,
  },
  time: {
    fontSize: 12,
    color: colors.muted,
  },
  timeOwn: {
    color: colors.onAccentSoft,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  textOwn: {
    color: colors.onAccent,
  },
  system: {
    alignSelf: 'center',
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
  },
  typing: {
    minHeight: 24,
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontSize: 13,
    color: colors.muted,
  },
  typingPending: {
    color: colors.offline,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  sendButton: {
    minHeight: 44,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sendButtonPressed: {
    backgroundColor: colors.accentDark,
  },
  sendText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34, 31, 27, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  usersPanel: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxWidth: 400,
    maxHeight: '80%',
    width: '100%',
    alignSelf: 'center',
  },
  usersTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 12,
  },
  sectionGap: {
    marginTop: 16,
  },
  roomRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  roomRowCurrent: {
    backgroundColor: colors.accentSoft,
  },
  roomRowText: {
    fontSize: 16,
    color: colors.ink,
  },
  roomRowTextCurrent: {
    fontWeight: '600',
  },
  userRow: {
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 6,
  },
});
