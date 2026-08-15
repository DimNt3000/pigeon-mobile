import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';

import JoinScreen from './src/JoinScreen';
import ChatScreen from './src/ChatScreen';
import { DEFAULT_SERVER_URL, DEFAULT_ROOM } from './src/config';

const TYPING_IDLE_MS = 1500;
const JOIN_TIMEOUT_MS = 5000;

export default function App() {
  const socketRef = useRef(null);
  const usernameRef = useRef(null);
  const roomRef = useRef(null);
  const nextIdRef = useRef(1);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const [phase, setPhase] = useState('join'); // 'join' | 'chat'
  const [username, setUsername] = useState(null);
  const [room, setRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
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

  function historyToItems(history) {
    return history
      .map((message) => ({ id: nextIdRef.current++, kind: 'message', ...message }))
      .reverse();
  }

  function applyJoin(response) {
    usernameRef.current = response.username;
    roomRef.current = response.room;
    setUsername(response.username);
    setRoom(response.room);
    setTypingUsers([]);
    setMessages(historyToItems(response.history));
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

  function joinChat(rawName, rawUrl, rawRoom) {
    const name = rawName.trim();
    const url = rawUrl.trim().replace(/\/+$/, '');
    const initialRoom = (rawRoom ?? '').trim() || DEFAULT_ROOM;
    if (!name || !url) return;

    socketRef.current?.disconnect();
    setJoining(true);
    setJoinError(null);

    const socket = io(url, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const isRejoin = usernameRef.current !== null;
      const payload = {
        name: usernameRef.current ?? name,
        room: roomRef.current ?? initialRoom,
      };
      socket.timeout(JOIN_TIMEOUT_MS).emit('join', payload, (err, response) => {
        if (err || !response || response.error) {
          if (isRejoin) return; // stay connected, the next reconnect cycle retries
          socket.disconnect();
          socketRef.current = null;
          setJoining(false);
          setJoinError(response?.error ?? 'The server did not reply to the join request.');
          return;
        }
        applyJoin(response); // on rejoin this also replays messages missed while offline
        if (!isRejoin) {
          setJoining(false);
          setPhase('chat');
        }
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

    socket.on('rooms', (list) => setRooms(list));

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

  function switchRoom(nextRoom) {
    const socket = socketRef.current;
    if (!socket || !usernameRef.current || nextRoom === roomRef.current) return;
    emitTypingStop();
    socket
      .timeout(JOIN_TIMEOUT_MS)
      .emit('join', { name: usernameRef.current, room: nextRoom }, (err, response) => {
        if (err || !response || response.error) return;
        applyJoin(response);
      });
  }

  function leaveChat() {
    emitTypingStop();
    socketRef.current?.disconnect();
    socketRef.current = null;
    usernameRef.current = null;
    roomRef.current = null;
    setPhase('join');
    setUsername(null);
    setRoom(null);
    setRooms([]);
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
          room={room}
          rooms={rooms}
          connected={connected}
          users={users}
          messages={messages}
          typingUsers={typingUsers}
          onSend={sendMessage}
          onSwitchRoom={switchRoom}
          onTypingChange={handleTypingChange}
          onLeave={leaveChat}
        />
      )}
    </SafeAreaProvider>
  );
}
