import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { 
  MessageSquare, UserCircle, Search, LogOut, 
  Video, Gamepad2,
  Bell, X
} from 'lucide-react';
import ChatRoom from './ChatRoom';
import GameStage from './GameStage';
import CallOverlay from './CallOverlay';

interface UserProfile {
  id: string;
  name: string;
  status: string;
}

export default function MainApp({ user, socket, peer }: { user: any, socket: Socket, peer: Peer }) {
  const [activeChat, setActiveChat] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<Record<string, any[]>>(() => {
    const saved = localStorage.getItem('social_app_messages_' + user.id);
    return saved ? JSON.parse(saved) : {};
  });
  const [searchId, setSearchId] = useState('');
  const [showRequests, setShowRequests] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [pendingInvite, setPendingInvite] = useState<any>(null);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [toast, setToast] = useState<any>(null);
  const currentCallRef = useRef<any>(null);

  const [callState, setCallState] = useState<{
    isActive: boolean;
    type: 'voice' | 'video';
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMicOn: boolean;
    isVideoOn: boolean;
  }>({
    isActive: false,
    type: 'video',
    localStream: null,
    remoteStream: null,
    isMicOn: true,
    isVideoOn: true
  });

  // Save messages to local storage
  useEffect(() => {
    const limitedMessages = { ...allMessages };
    for (const key in limitedMessages) {
      if (limitedMessages[key].length > 50) {
        limitedMessages[key] = limitedMessages[key].slice(-50);
      }
    }
    localStorage.setItem('social_app_messages_' + user.id, JSON.stringify(limitedMessages));
  }, [allMessages, user.id]);

  useEffect(() => {
    // Permission Warmup for faster calls
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch((_e) => console.log('Media permissions not yet granted'));

    if (socket) {
      socket.emit('sync-session', { userId: user.id });
      socket.emit('get-initial-data', { userId: user.id });

      socket.on('initial-data', ({ friends, requests }) => {
        setContacts(friends);
        setRequests(requests);
      });

      socket.on('incoming-request', (request) => {
        setRequests(prev => [...prev.filter(r => r.id !== request.fromId), { id: request.fromId, name: request.fromName }]);
      });

      socket.on('request-accepted', ({ friend }) => {
        setContacts(prev => [...prev.filter(c => c.id !== friend.id), friend]);
        setRequests(prev => prev.filter(r => r.id !== friend.id));
      });

      socket.on('user-status-change', ({ userId, status }) => {
        setContacts(prev => prev.map(c => c.id === userId ? { ...c, status } : c));
      });

      socket.on('receive-message', (msg) => {
        setAllMessages(prev => {
          const chatHistory = prev[msg.from] || [];
          return { ...prev, [msg.from]: [...chatHistory, msg] };
        });
        
        // Show toast if not currently in chat with sender
        if (activeChat?.id !== msg.from) {
          const sender = contacts.find(c => c.id === msg.from);
          setToast({ title: sender?.name || 'New Message', content: msg.content });
          setTimeout(() => setToast(null), 3000);
        }
      });

      socket.on('user-typing', ({ from }) => {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.add(from);
          return next;
        });
      });

      socket.on('user-stop-typing', ({ from }) => {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(from);
          return next;
        });
      });

      socket.on('incoming-call', ({ from, peerId, type }) => {
        const caller = contacts.find(c => c.id === from);
        setPendingInvite({ type: 'call', from, name: caller?.name, peerId, callType: type });
      });

      socket.on('incoming-game', ({ from, game }) => {
        const initiator = contacts.find(c => c.id === from);
        setPendingInvite({ type: 'game', from, name: initiator?.name, game });
      });

      socket.on('close-game', () => {
        setActiveGame(null);
      });

      // Global Call Answer Sync
      peer.on('call', (call) => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
          setCallState(prev => ({ ...prev, isActive: true, localStream: stream }));
          call.answer(stream);
          currentCallRef.current = call;
          call.on('stream', (remoteStream) => {
            setCallState(prev => ({ ...prev, remoteStream }));
          });
        });
      });
    }

    return () => {
      socket?.off('initial-data');
      socket?.off('incoming-request');
      socket?.off('request-accepted');
      socket?.off('user-status-change');
      socket?.off('receive-message');
      socket?.off('incoming-call');
      socket?.off('incoming-game');
      socket?.off('close-game');
      socket?.off('user-typing');
      socket?.off('user-stop-typing');
      peer?.off('call');
    };
  }, [socket, activeChat, contacts, peer]);

  // Handle friend requests / finding users by ID
  const handleAddFriend = () => {
    if (!searchId || searchId === user.id) return;
    socket.emit('send-friend-request', { toId: searchId });
    setSearchId('');
    setToast({ title: 'Success', content: 'Friend request sent!' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAcceptRequest = (fromId: string) => {
    socket.emit('accept-friend-request', { fromId });
    // Optimistic UI update or wait for request-accepted event
  };

  const handleLogout = () => {
    localStorage.removeItem('social_app_user');
    window.location.reload();
  };

  const startCall = async (type: 'voice' | 'video', incomingPeerId?: string, isIncoming = false) => {
    if (!activeChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: type === 'video', 
        audio: true 
      });
      
      setCallState(prev => ({ ...prev, isActive: true, type, localStream: stream }));

      if (!isIncoming) {
        socket.emit('initiate-call', { to: activeChat.id, peerId: peer.id, type });
      } else if (incomingPeerId) {
        const call = peer.call(incomingPeerId, stream);
        currentCallRef.current = call;
        call.on('stream', (remoteStream) => {
          setCallState(prev => ({ ...prev, remoteStream }));
        });
      }
    } catch (err) {
      console.error("Failed to get media", err);
    }
  };

  const endCall = () => {
    callState.localStream?.getTracks().forEach(t => t.stop());
    currentCallRef.current?.close();
    setCallState(prev => ({ 
      ...prev, 
      isActive: false, 
      localStream: null, 
      remoteStream: null 
    }));
  };

  const toggleMic = () => {
    callState.localStream?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setCallState(prev => ({ ...prev, isMicOn: !prev.isMicOn }));
  };

  const toggleVideo = () => {
    callState.localStream?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setCallState(prev => ({ ...prev, isVideoOn: !prev.isVideoOn }));
  };

  const handleScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      if (currentCallRef.current) {
        const sender = currentCallRef.current.peerConnection.getSenders().find((s: any) => s.track.kind === 'video');
        sender?.replaceTrack(videoTrack);
      }
      videoTrack.onended = () => {
        startCall(callState.type);
      };
    } catch (err) {
      console.error("Screen share failed", err);
    }
  };

  return (
    <div className="layout glass-card" style={{ width: '95vw', height: '90vh', border: 'none', background: 'rgba(15, 23, 42, 0.4)' }}>
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'mobile-sidebar' : 'desktop-sidebar'}`} style={{ 
        borderRight: '1px solid var(--glass-border)', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'rgba(255, 255, 255, 0.02)'
      }}>
        {/* User Profile Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(45deg, #6366f1, #ec4899)' }}></div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{user.name}</h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.id}</p>
            </div>
            <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white' }}>
              <X size={18} />
            </button>
            <button 
              onClick={() => setShowRequests(!showRequests)} 
              title="Friend Requests"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: requests.length > 0 ? 'var(--secondary)' : 'var(--text-muted)', position: 'relative' }}
            >
              <Bell size={18} />
              {requests.length > 0 && (
                <div style={{ position: 'absolute', top: -5, right: -5, width: 8, height: 8, background: 'var(--secondary)', borderRadius: '50%' }}></div>
              )}
            </button>
            <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
              <LogOut size={18} />
            </button>
          </div>
          
          {showRequests && requests.length > 0 && (
            <div className="glass-card animate-fade-in" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
              <h5 style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--secondary)' }}>Pending Requests</h5>
              {requests.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem' }}>{r.name}</span>
                  <button 
                    onClick={() => handleAcceptRequest(r.id)}
                    style={{ background: 'var(--secondary)', border: 'none', padding: '4px 8px', borderRadius: '4px', color: 'white', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="input-group" style={{ marginBottom: 0, marginTop: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input 
                placeholder="Find by user#ID..." 
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Contacts</h4>
          {contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <UserCircle size={32} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>No contacts yet.<br/>Search by ID to add friends.</p>
            </div>
          ) : (
            contacts.map(c => (
              <div 
                key={c.id}
                onClick={() => { setActiveChat(c); setIsSidebarOpen(false); }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '0.75rem', 
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  background: activeChat?.id === c.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155' }}></div>
                  <div style={{ 
                    position: 'absolute', bottom: 0, right: 0, 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    background: c.status === 'online' ? '#22c55e' : '#64748b',
                    border: '2px solid #0f172a'
                  }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.id}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {activeChat ? (
          <ChatRoom 
            user={user} 
            activeChat={activeChat} 
            socket={socket} 
            messages={allMessages[activeChat.id] || []}
            isTyping={typingUsers.has(activeChat.id)}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            setActiveGame={setActiveGame}
            callState={callState}
            onStartCall={startCall}
            onEndCall={endCall}
            onToggleMic={toggleMic}
            onToggleVideo={toggleVideo}
            onScreenShare={handleScreenShare}
            onSendMessage={(msg: any) => {
              setAllMessages(prev => {
                const chatHistory = prev[activeChat.id] || [];
                return { ...prev, [activeChat.id]: [...chatHistory, msg] };
              });
            }}
            onClearChat={() => {
              setAllMessages(prev => {
                const next = { ...prev };
                delete next[activeChat.id];
                return next;
              });
            }}
            onToast={setToast}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <button className="btn btn-primary" style={{ marginBottom: '2rem' }} onClick={() => setIsSidebarOpen(true)}>Open Contacts</button>
            <MessageSquare size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' }}>Welcome back, {user.name}</h2>
            <p>Select a contact to start chatting or playing games.</p>
          </div>
        )}
      </div>

      {/* Global Notification Toast */}
      {toast && (
        <div className="glass-card animate-fade-in" style={{ position: 'fixed', top: '2rem', right: '2rem', padding: '1rem', zIndex: 1000, background: 'rgba(15, 23, 42, 0.95)', minWidth: '250px' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 'bold' }}>{toast.title}</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{toast.content}</div>
        </div>
      )}

      {/* Global Invite Modal */}
      {pendingInvite && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(45deg, #6366f1, #ec4899)', 
              margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              {pendingInvite.type === 'call' ? <Video color="white" /> : <Gamepad2 color="white" />}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{pendingInvite.name}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {pendingInvite.type === 'call' ? `Incoming ${pendingInvite.callType} call...` : `Wants to play ${pendingInvite.game}!`}
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={() => {
                  if (pendingInvite.type === 'game') {
                    setActiveGame(pendingInvite.game);
                    const contact = contacts.find(c => c.id === pendingInvite.from);
                    if (contact) setActiveChat(contact);
                  } else if (pendingInvite.type === 'call') {
                    startCall(pendingInvite.callType, pendingInvite.peerId, true);
                  }
                  setPendingInvite(null);
                }}
              >
                Accept
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }} 
                onClick={() => setPendingInvite(null)}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Global Overlays */}
      {callState.isActive && (
        <CallOverlay 
          {...callState}
          onEndCall={() => {
            callState.localStream?.getTracks().forEach(t => t.stop());
            currentCallRef.current?.close();
            setCallState(prev => ({ ...prev, isActive: false, localStream: null, remoteStream: null }));
          }}
          onToggleMic={() => {
            callState.localStream?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setCallState(prev => ({ ...prev, isMicOn: !prev.isMicOn }));
          }}
          onToggleVideo={() => {
            callState.localStream?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setCallState(prev => ({ ...prev, isVideoOn: !prev.isVideoOn }));
          }}
          onScreenShare={async () => {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const videoTrack = screenStream.getVideoTracks()[0];
            if (currentCallRef.current) {
              const sender = currentCallRef.current.peerConnection.getSenders().find((s: any) => s.track.kind === 'video');
              sender?.replaceTrack(videoTrack);
            }
          }}
        />
      )}

      {activeGame && activeChat && (
        <GameStage 
          game={activeGame} 
          user={user} 
          opponent={activeChat} 
          socket={socket} 
          onClose={() => setActiveGame(null)} 
        />
      )}
      <style>{`
        @media (min-width: 769px) { .mobile-close-btn { display: none !important; } }
      `}</style>
    </div>
  );
}
