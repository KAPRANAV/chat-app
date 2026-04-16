import { useState } from 'react';
import { UserPlus, Sparkles } from 'lucide-react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export default function Onboarding({ onProfileCreated }: { onProfileCreated: (p: any) => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateProfile = () => {
    if (!name.trim()) return;
    setLoading(true);

    const socket = io(SOCKET_URL);
    socket.emit('create-profile', { name });
    
    socket.on('profile-created', (profile) => {
      onProfileCreated(profile);
      socket.disconnect();
    });
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '3rem', maxWidth: '400px', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          background: 'rgba(99, 102, 241, 0.1)', 
          width: '64px', height: '64px', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 1rem'
        }}>
          <UserPlus size={32} color="#6366f1" />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>SocialConnect</h1>
        <p style={{ color: 'var(--text-muted)' }}>Experience real-time interaction like never before.</p>
      </div>

      <div className="input-group">
        <label>Display Name</label>
        <input 
          type="text" 
          placeholder="Enter your name..." 
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreateProfile()}
        />
      </div>

      <button 
        className="btn btn-primary" 
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={handleCreateProfile}
        disabled={loading}
      >
        {loading ? 'Creating...' : (
          <>
            <Sparkles size={18} />
            Create Profile
          </>
        )}
      </button>

      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Your unique ID will be generated automatically.
      </p>
    </div>
  );
}
