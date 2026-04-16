import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Video, Phone, Monitor, Gamepad2, 
  Smile, Paperclip, MoreVertical, X, PlusCircle, Menu
} from 'lucide-react';

interface Message {
  from: string;
  content: string;
  type: 'text' | 'image' | 'video';
  timestamp: string;
  mediaUrl?: string | null;
}

export default function ChatRoom({ 
  user, activeChat, socket, messages, 
  setActiveGame,
  isTyping, onOpenSidebar,
  onStartCall, onScreenShare,
  onSendMessage, onClearChat, onToast 
}: any) {
  const [input, setInput] = useState('');
  const [showGames, setShowGames] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    socket.emit('typing', { to: activeChat.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { to: activeChat.id });
    }, 1500);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content: string, type: 'text' | 'image' | 'video' = 'text', mediaUrl?: string) => {
    if (!content.trim() && !mediaUrl) return;
    const msg: Message = {
      from: user.id,
      content,
      type,
      timestamp: new Date().toISOString(),
      mediaUrl: mediaUrl || null
    };
    onSendMessage(msg);
    socket.emit('send-message', { to: activeChat.id, content, type, mediaUrl });
    setInput('');
    setShowEmojis(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onToast({ title: 'Upload Failed', content: 'File too large. Max size is 10MB.' });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      handleSendMessage('', type, event.target?.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const emojis = ['😊', '😂', '🔥', '❤️', '👍', '🙌', '✨', '🚀', '🤔', '😎', '😢', '😍', '🎉', '👋', '💯', '🌈'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem 1.5rem', 
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.01)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn mobile-menu-btn" onClick={onOpenSidebar} style={{ display: 'none' }}>
            <Menu size={20} />
          </button>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155' }}></div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{activeChat.name}</div>
            <div style={{ fontSize: '0.7rem', color: '#22c55e' }}>Online</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="icon-btn" onClick={() => onStartCall('voice')}><Phone size={20} /></button>
          <button className="icon-btn" onClick={() => onStartCall('video')}><Video size={20} /></button>
          <button className="icon-btn" onClick={onScreenShare}><Monitor size={20} /></button>
          <button className="icon-btn" onClick={() => setShowGames(!showGames)} style={{ color: showGames ? 'var(--primary)' : 'inherit' }}>
            <Gamepad2 size={20} />
          </button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={20} /></button>
            {menuOpen && (
              <div className="glass-card animate-fade-in" style={{ 
                position: 'absolute', top: '100%', right: 0, 
                width: '180px', padding: '0.5rem', zIndex: 100,
                background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)'
              }}>
                <button className="menu-item" onClick={() => { onClearChat(); setMenuOpen(false); }}>Clear Chat</button>
                <button className="menu-item" onClick={() => { setShowUserInfo(true); setMenuOpen(false); }}>User Info</button>
                <button className="menu-item" style={{ color: '#ef4444' }} onClick={() => setMenuOpen(false)}>Block User</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>
            <p>Start a conversation with {activeChat.name}</p>
          </div>
        )}
        {messages.map((m: Message, i: number) => (
          <div key={i} style={{ 
            alignSelf: m.from === user.id ? 'flex-end' : 'flex-start',
            maxWidth: '70%',
            padding: '0.75rem 1rem',
            borderRadius: m.from === user.id ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
            background: m.from === user.id ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'rgba(255, 255, 255, 0.05)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '0.9rem',
            position: 'relative'
          }}>
            {m.type === 'text' && <div>{m.content}</div>}
            {m.type === 'image' && <img src={m.mediaUrl || ''} style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '0.25rem' }} alt="Sent image" />}
            {m.type === 'video' && <video src={m.mediaUrl || ''} controls style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '0.25rem' }} />}
            
            <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '0.25rem', textAlign: 'right' }}>
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <span className="typing-dots">{activeChat.name} is typing</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.01)', position: 'relative' }}>
        {showEmojis && (
          <div className="glass-card animate-fade-in" style={{ 
            position: 'absolute', bottom: '100%', left: '1.5rem', 
            padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem',
            background: 'rgba(15, 23, 42, 0.98)', border: '1px solid var(--glass-border)',
            zIndex: 100, marginBottom: '0.5rem'
          }}>
            {emojis.map(e => (
              <button key={e} onClick={() => setInput(prev => prev + e)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
        )}
        <div className="glass-card" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)' }}>
          <button className="icon-btn" onClick={() => setShowEmojis(!showEmojis)}><Smile size={20} /></button>
          <button className="icon-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload}
            accept="image/*,video/*"
          />
          <input 
            type="text" 
            placeholder={isUploading ? "Uploading media..." : "Type a message..."} 
            value={input}
            disabled={isUploading}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(input)}
            style={{ border: 'none', background: 'transparent' }}
          />
          <button onClick={() => handleSendMessage(input)} disabled={isUploading} style={{ 
            background: isUploading ? 'var(--text-muted)' : 'var(--primary)', 
            color: 'white', 
            border: 'none', 
            borderRadius: '0.5rem', 
            width: '40px', height: '40px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            cursor: isUploading ? 'not-allowed' : 'pointer' 
          }}>
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Games Modal/Drawer */}
      {showGames && (
        <div className="glass-card animate-fade-in" style={{ 
          position: 'fixed', bottom: '120px', right: '1.5rem', 
          width: '300px', padding: '1.5rem', zIndex: 50,
          background: 'rgba(15, 23, 42, 0.98)', border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Play Mini-Games</h3>
            <button onClick={() => setShowGames(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button className="game-btn" onClick={() => { setActiveGame('tictactoe'); socket.emit('game-invite', { to: activeChat.id, game: 'tictactoe' }); setShowGames(false); }}>
              <Gamepad2 size={24} />
              <span>Tic Tac Toe</span>
            </button>
            <button className="game-btn" onClick={() => { setActiveGame('tennis'); socket.emit('game-invite', { to: activeChat.id, game: 'tennis' }); setShowGames(false); }}>
              <Gamepad2 size={24} />
              <span>Tennis</span>
            </button>
            <button className="game-btn">
              <PlusCircle size={24} />
              <span>Coming Soon</span>
            </button>
          </div>
        </div>
      )}

      {/* Call Overlay handled by MainApp */}

      {/* User Info Modal */}
      {showUserInfo && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)'
        }}>
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(45deg, #6366f1, #ec4899)', margin: '0 auto 1.5rem' }}></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{activeChat.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>ID: {activeChat.id}</p>
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
                <span style={{ fontSize: '0.9rem' }}>Active Member</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowUserInfo(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Global Invite Modal handled by MainApp */}

      <style>{`
        .icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .icon-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
        }
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
        }
        .game-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .game-btn:hover {
          background: var(--primary);
          transform: translateY(-2px);
        }
        .game-btn span {
          font-size: 0.75rem;
          font-weight: 600;
        }
        .menu-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .menu-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
