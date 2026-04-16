import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import Onboarding from './components/Onboarding';
import MainApp from './components/MainApp';
import './index.css';

const SOCKET_URL = 'http://localhost:3001';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing profile
    const savedUser = localStorage.getItem('social_app_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && !socket) {
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);

      const newPeer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      });
      setPeer(newPeer);

      newSocket.on('connect', () => {
        console.log('Connected to socket server');
        if (user.id) {
          // Re-sync with server if needed
          // For now we just create a fresh one if we don't have an ID
        }
      });

      return () => {
        newSocket.close();
        newPeer.destroy();
      };
    }
  }, [user]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="app-container">
      {!user ? (
        <Onboarding onProfileCreated={(profile) => {
          setUser(profile);
          localStorage.setItem('social_app_user', JSON.stringify(profile));
        }} />
      ) : (
        <MainApp user={user} socket={socket!} peer={peer!} />
      )}
    </div>
  );
}
