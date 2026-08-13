import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';

import JoinScreen from './src/JoinScreen';
import ChatScreen from './src/ChatScreen';
import { DEFAULT_SERVER_URL } from './src/config';

const TYPING_IDLE_MS = 1500;
const JOIN_TIMEOUT_MS = 5000;

export default function App() {
  const socketRef = useRef(null);
  const usernameRef = useRef(null);
  const nextIdRef = useRef(1);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const [phase, setPhase] = useState('join'); // 'join' | 'chat'
  const [username, setUsername] = useState(null);
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [messages, setMessages] = useState([]); // newest first, rendered by an inverted list
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => () => socketRef.current?.disconnect(), []);

  function addItem(kind, payload) {
    setMessages((prev) => [{ id: nextIdRef.current++, kind, ...payload }, ...prev]);
  }

  function emitTypingStop() {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit('typing', false);
    }
  }

  function handleTypingChange(hasText) {
    if (!hasText) {
      emitTypingStop();
      return;
    }
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current?.emit('typing', true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(emitTypingStop, TYPING_IDLE_MS);
  }

  function joinChat(rawName, rawUrl) {
    const name = rawName.trim();
    const url = rawUrl.trim().replace(/\/+$/, '');
    if (!name || !url) return;

    socketRef.current?.disconnect();
    setJoining(true);
    setJoinError(null);

    const socket = io(url, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const isRejoin = usernameRef.current !== null;
      socket.timeout(JOIN_TIMEOUT_MS).emit('join', usernameRef.current ?? name, (err, response) => {
        if (isRejoin) return; // reconnect: the server re-registered us, nothing to render
        if (err || !response || response.error) {
          socket.disconnect();
          socketRef.current = null;
          setJoining(false);
          setJoinError(response?.error ?? 'The server did not reply to the join request.');
          return;
        }
        usernameRef.current = response.username;
        setUsername(response.username);
        setMessages(
          response.history
            .map((message) => ({ id: nextIdRef.current++, kind: 'message', ...message }))
            .reverse()
        );
        setJoining(false);
        setPhase('chat');
      });
    });

    socket.on('connect_error', () => {
      // Before the first successful join, give up and let the user fix the address.
      // After it, socket.io keeps retrying and the header shows "Reconnecting".
      if (usernameRef.current === null) {
        socket.disconnect();
        socketRef.current = null;
        setJoining(false);
        setJoinError(`Could not reach the server at ${url}. Check the address and that the server is running.`);
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setTypingUsers([]);
    });

    socket.on('chat message', (message) => {
      setTypingUsers((prev) => prev.filter((n) => n !== message.user));
      addItem('message', message);
    });

    socket.on('system', (event) => addItem('system', event));

    socket.on('users', (names) => setUsers(names));

    socket.on('typing', ({ user, isTyping }) => {
      setTypingUsers((prev) => {
        const without = prev.filter((n) => n !== user);
        return isTyping ? [...without, user] : without;
      });
    });
  }

  function sendMessage(text) {
    socketRef.current?.emit('chat message', text);
    emitTypingStop();
  }

  function leaveChat() {
    emitTypingStop();
    socketRef.current?.disconnect();
    socketRef.current = null;
    usernameRef.current = null;
    setPhase('join');
    setUsername(null);
    setConnected(false);
    setJoining(false);
    setJoinError(null);
    setMessages([]);
    setUsers([]);
    setTypingUsers([]);
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {phase === 'join' ? (
        <JoinScreen
          defaultServerUrl={DEFAULT_SERVER_URL}
          joining={joining}
          error={joinError}
          onJoin={joinChat}
        />
      ) : (
        <ChatScreen
          username={username}
          connected={connected}
          users={users}
          messages={messages}
          typingUsers={typingUsers}
          onSend={sendMessage}
          onTypingChange={handleTypingChange}
          onLeave={leaveChat}
        />
      )}
    </SafeAreaProvider>
  );
}
