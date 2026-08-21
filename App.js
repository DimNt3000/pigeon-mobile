import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';

import JoinScreen from './src/JoinScreen';
import ChatScreen from './src/ChatScreen';
import { DEFAULT_SERVER_URL, DEFAULT_ROOM } from './src/config';

const TYPING_IDLE_MS = 1500;
const JOIN_TIMEOUT_MS = 5000;
const MAX_OUTBOX = 50;

// Identifies this app session for as long as it is running, nothing more. It is
// what tells two people who picked the same display name apart, and what lets a
// reconnect be recognised as the same person. Nothing is stored on the device,
// and Hermes has no crypto.randomUUID, so this is built by hand.
const MY_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export default function App() {
  const socketRef = useRef(null);
  const usernameRef = useRef(null);
  const roomRef = useRef(null);
  const outboxRef = useRef([]); // messages typed while offline, sent on rejoin
  const joinedHereRef = useRef(false);
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
  const [pending, setPending] = useState(0);

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
    joinedHereRef.current = true;
    setUsername(response.username);
    setRoom(response.room);
    setTypingUsers([]);
    setMessages(historyToItems(response.history));
    flushOutbox();
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
        clientId: MY_ID,
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
      // The next connection gets a new socket id, so the server will not know
      // us again until the rejoin is acknowledged.
      joinedHereRef.current = false;
      setTypingUsers([]);
    });

    socket.on('chat message', (message) => {
      setTypingUsers((prev) => prev.filter((n) => n !== message.user));
      addItem('message', message);
    });

    socket.on('system', (event) => addItem('system', event));

    socket.on('users', (people) => setUsers(people));

    socket.on('rooms', (list) => setRooms(list));

    socket.on('typing', ({ clientId, user, isTyping }) => {
      if (clientId === MY_ID) return; // our own echo, e.g. the same name on another device
      setTypingUsers((prev) => {
        const without = prev.filter((n) => n !== user);
        return isTyping ? [...without, user] : without;
      });
    });
  }

  // Only true once the server has confirmed us into a room on this connection.
  // Between the socket connecting and the rejoin being acknowledged the server
  // has no record of us, so anything sent in that window is discarded.
  function canSend() {
    return Boolean(socketRef.current?.connected) && joinedHereRef.current;
  }

  // Socket.IO would buffer a message sent while offline, but it flushes that
  // buffer before we get to rejoin, so the server would drop it silently. Hold
  // it here instead and send it once we are back in the room.
  function sendMessage(text) {
    if (canSend()) {
      socketRef.current.emit('chat message', text);
    } else if (outboxRef.current.length < MAX_OUTBOX) {
      outboxRef.current.push(text);
      setPending(outboxRef.current.length);
    }
    emitTypingStop();
  }

  function flushOutbox() {
    while (outboxRef.current.length && canSend()) {
      socketRef.current.emit('chat message', outboxRef.current.shift());
    }
    setPending(outboxRef.current.length);
  }

  function switchRoom(nextRoom) {
    const socket = socketRef.current;
    if (!socket || !usernameRef.current || nextRoom === roomRef.current) return;
    emitTypingStop();
    socket
      .timeout(JOIN_TIMEOUT_MS)
      .emit('join', { clientId: MY_ID, name: usernameRef.current, room: nextRoom }, (err, response) => {
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
    joinedHereRef.current = false;
    outboxRef.current = [];
    setPending(0);
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
          myId={MY_ID}
          messages={messages}
          typingUsers={typingUsers}
          pending={pending}
          onSend={sendMessage}
          onSwitchRoom={switchRoom}
          onTypingChange={handleTypingChange}
          onLeave={leaveChat}
        />
      )}
    </SafeAreaProvider>
  );
}
