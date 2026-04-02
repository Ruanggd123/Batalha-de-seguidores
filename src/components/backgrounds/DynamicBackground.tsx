import React, { useRef, useEffect } from 'react';

const DynamicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let stars: { x: number; y: number; z: number; }[] = [];
    const numStars = 500;
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * canvas.width - canvas.width / 2,
                y: Math.random() * canvas.height - canvas.height / 2,
                z: Math.random() * canvas.width
            });
        }
    };
    
    const draw = () => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- CYBER GRID FLOOR EFFECT ---
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.1)';
        ctx.lineWidth = 1;
        const spacing = 100;
        const time = Date.now() * 0.0005;
        const offsetX = (Math.sin(time) * 20);
        const offsetY = (Math.cos(time) * 20);

        for (let x = (offsetX % spacing); x < canvas.width; x += spacing) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = (offsetY % spacing); y < canvas.height; y += spacing) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // --- GLOWING ARENA BORDERS ---
        const padding = 10;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#c084fc';
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.8)';
        ctx.lineWidth = 4;
        ctx.strokeRect(padding, padding, canvas.width - padding*2, canvas.height - padding*2);
        
        ctx.shadowBlur = 0; // Reset for stars

        // --- MOVING STARS ---
        ctx.translate(canvas.width / 2, canvas.height / 2);
        stars.forEach(star => {
            star.z -= 1;
            if (star.z <= 0) {
                star.x = Math.random() * canvas.width - canvas.width / 2;
                star.y = Math.random() * canvas.height - canvas.height / 2;
                star.z = canvas.width;
            }

            const k = 128 / star.z;
            const px = star.x * k;
            const py = star.y * k;
            const r = Math.max(0.1, 1.5 * k);
            
            ctx.beginPath();
            ctx.fillStyle = `rgba(192, 132, 252, ${r > 0.5 ? 0.8 : 0.4})`;
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
        animationFrameId = requestAnimationFrame(draw);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full -z-10 overflow-hidden bg-[#0c0a15]">
      {/* High-End Arena Floor Texture */}
      <img 
        src="/arena_floor_texture_1775137155078.png" 
        className="absolute inset-0 w-full h-full object-cover opacity-75 scale-110 animate-[slow-zoom_30s_infinite_alternate]"
        alt="Arena Floor"
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
      {/* Vignette Overlay for Depth */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/60 pointer-events-none" />
    </div>
  );
};

export default DynamicBackground;
