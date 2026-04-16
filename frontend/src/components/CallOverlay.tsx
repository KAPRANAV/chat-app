import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, Maximize2, Minimize2 } from 'lucide-react';

interface CallOverlayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEndCall: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onScreenShare: () => void;
  isMicOn: boolean;
  isVideoOn: boolean;
  type: 'voice' | 'video';
}

export default function CallOverlay({ 
  localStream, remoteStream, onEndCall, onToggleMic, 
  onToggleVideo, onScreenShare, isMicOn, isVideoOn, type 
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className={`glass-card animate-fade-in ${isMinimized ? 'minimized-call' : 'full-call'}`} style={{ 
      position: 'fixed', 
      bottom: '2rem', 
      right: '2rem', 
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.95)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Remote Video (Main) */}
      <div style={{ flex: 1, background: '#000', position: 'relative', minHeight: isMinimized ? '150px' : '400px' }}>
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        {!remoteStream && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p>Connecting...</p>
          </div>
        )}
        
        {/* Local Video (PIP) */}
        {!isMinimized && (
          <div style={{ 
            position: 'absolute', bottom: '1rem', right: '1rem', 
            width: '120px', height: '160px', borderRadius: '12px', 
            overflow: 'hidden', border: '2px solid var(--glass-border)',
            background: '#111'
          }}>
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ 
        padding: '1.5rem', 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '1.5rem',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <button className={`control-btn ${!isMicOn ? 'off' : ''}`} onClick={onToggleMic}>
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        {type === 'video' && (
          <button className={`control-btn ${!isVideoOn ? 'off' : ''}`} onClick={onToggleVideo}>
            {isVideoOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
          </button>
        )}
        <button className="control-btn" onClick={onScreenShare}>
          <Monitor size={20} />
        </button>
        <button className="control-btn end" onClick={onEndCall}>
          <PhoneOff size={20} />
        </button>
        <button className="control-btn" onClick={() => setIsMinimized(!isMinimized)}>
          {isMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
        </button>
      </div>

      <style>{`
        .full-call { width: 600px; height: 550px; }
        .minimized-call { width: 250px; height: auto; }
        .control-btn {
          width: 44px; height: 44px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .control-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
        .control-btn.off { background: #ef4444; }
        .control-btn.end { background: #ef4444; width: 54px; height: 54px; }
        
        @media (max-width: 768px) {
          .full-call { width: 90vw; height: 70vh; right: 5vw; bottom: 5vh; }
        }
      `}</style>
    </div>
  );
}
