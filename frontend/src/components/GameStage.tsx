import { useState, useEffect, useRef } from 'react';
import { X, Trophy } from 'lucide-react';

export default function GameStage({ game, user, opponent, socket, onClose }: any) {
  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      zIndex: 2000, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(30px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'absolute', top: '2rem', right: '2rem' }}>
        <button onClick={() => { 
          onClose(); 
          socket.emit('close-game', { to: opponent.id });
        }} className="icon-btn" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(to right, #6366f1, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {game === 'tictactoe' ? 'Tic Tac Toe' : 'Tennis'}
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>Playing with {opponent.name}</p>
      </div>

      <div className="glass-card" style={{ padding: '1rem', background: '#000' }}>
        {game === 'tictactoe' && <TicTacToe socket={socket} opponentId={opponent.id} role={user.id < opponent.id ? 'X' : 'O'} />}
        {game === 'tennis' && <Tennis socket={socket} opponentId={opponent.id} role={user.id < opponent.id ? 'p1' : 'p2'} />}
      </div>
    </div>
  );
}

function TicTacToe({ socket, opponentId, role }: any) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState('X');

  useEffect(() => {
    socket.on('game-move-special', ({ game, data }: any) => {
      if (game === 'tictactoe') {
        const { index, symbol } = data;
        setBoard(prev => {
          const next = [...prev];
          next[index] = symbol;
          return next;
        });
        setTurn(symbol === 'X' ? 'O' : 'X');
      }
    });
    return () => { socket.off('game-move-special'); };
  }, [socket]);

  const handleClick = (i: number) => {
    if (board[i] || turn !== role) return;
    const newBoard = [...board];
    newBoard[i] = role;
    setBoard(newBoard);
    setTurn(role === 'X' ? 'O' : 'X');
    socket.emit('game-move-special', { to: opponentId, game: 'tictactoe', data: { index: i, symbol: role } });
  };

  const checkWinner = (squares: any[]) => {
    const lines = [
      [0,1,2], [3,4,5], [6,7,8], // Rows
      [0,3,6], [1,4,7], [2,5,8], // Cols
      [0,4,8], [2,4,6]          // Diags
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const winner = checkWinner(board);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 100px)', gap: '10px' }}>
        {board.map((cell, i) => (
          <div key={i} onClick={() => handleClick(i)} style={{ 
            width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
            cursor: 'pointer', borderRadius: '8px', color: cell === 'X' ? '#6366f1' : '#ec4899',
            opacity: winner && cell !== winner ? 0.3 : 1,
            transition: 'all 0.3s'
          }}>
            {cell}
          </div>
        ))}
      </div>
      {winner && (
        <div className="glass-card animate-fade-in" style={{ 
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          padding: '2rem', background: 'rgba(15, 23, 42, 0.95)', border: '2px solid var(--secondary)',
          textAlign: 'center', zIndex: 10, width: '200px'
        }}>
          <Trophy size={48} color={winner === role ? '#fbbf24' : '#64748b'} style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{winner === role ? 'YOU WIN!' : 'THEY WON!'}</h3>
          <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setBoard(Array(9).fill(null))}>Restart</button>
        </div>
      )}
    </div>
  );
}

function Tennis({ socket, opponentId, role }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const p1Ref = useRef(150);
  const p2Ref = useRef(150);
  const ballRef = useRef({ x: 300, y: 200, dx: 4, dy: 4 });
  const [scores, setScores] = useState({ p1: 0, p2: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      const ball = ballRef.current;
      
      if (role === 'p1') {
        ball.x += ball.dx;
        ball.y += ball.dy;

        if (ball.y < 0 || ball.y > canvas.height) ball.dy *= -1;
        if (ball.x < 30 && ball.y > p1Ref.current && ball.y < p1Ref.current + 80) { ball.dx = Math.abs(ball.dx); }
        if (ball.x > canvas.width - 30 && ball.y > p2Ref.current && ball.y < p2Ref.current + 80) { ball.dx = -Math.abs(ball.dx); }

        if (ball.x < 0 || ball.x > canvas.width) {
          // Score detection
          const winner = ball.x < 0 ? 'p2' : 'p1';
          socket.emit('game-move-special', { to: opponentId, game: 'tennis-score', data: { winner } });
          ball.x = 300; ball.y = 200;
        }
        socket.emit('game-move-special', { to: opponentId, game: 'tennis-ball', data: { x: ball.x, y: ball.y } });
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw score
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 40px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(`${scores.p1}  -  ${scores.p2}`, canvas.width/2, 50);

      ctx.fillStyle = '#6366f1'; ctx.fillRect(10, p1Ref.current, 10, 80);
      ctx.fillStyle = '#ec4899'; ctx.fillRect(canvas.width - 20, p2Ref.current, 10, 80);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI*2); ctx.fill();
      requestAnimationFrame(update);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const y = Math.max(0, Math.min(canvas.height - 80, e.clientY - rect.top - 40));
      if (role === 'p1') p1Ref.current = y; else p2Ref.current = y;
      socket.emit('game-move', { to: opponentId, paddleY: y });
    };

    socket.on('opponent-move', ({ paddleY }: any) => {
      if (role === 'p1') p2Ref.current = paddleY; else p1Ref.current = paddleY;
    });

    socket.on('game-move-special', ({ game, data }: any) => {
      if (game === 'tennis-ball' && role === 'p2') {
        ballRef.current.x = data.x;
        ballRef.current.y = data.y;
      }
      if (game === 'tennis-score') {
        setScores(prev => ({ ...prev, [data.winner]: prev[data.winner as keyof typeof prev] + 1 }));
      }
    });

    canvas.addEventListener('mousemove', handleMouseMove);
    const animId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      socket.off('opponent-move');
    };
  }, [socket, opponentId, role]);

  return <canvas ref={canvasRef} width={600} height={400} style={{ borderRadius: '12px', border: '2px solid var(--glass-border)' }} />;
}
