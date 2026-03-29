import React, { useRef, useEffect } from 'react';

const WinnerConfetti: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const confetti: any[] = [];
    const confettiCount = 300;
    const colors = [
        '#f9d71c', '#00c4ff', '#ff69b4', '#32cd32', '#ff4500', '#9370db'
    ];

    const setup = () => {
      if(!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      
      for (let i = 0; i < confettiCount; i++) {
        confetti.push({
          x: Math.random() * canvas.width,
          y: Math.random() * -canvas.height,
          radius: Math.random() * 5 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: Math.random() * 8 - 4,
          vy: Math.random() * 5 + 2,
          angle: 0,
          spin: Math.random() * 0.2 - 0.1,
          opacity: 1,
        });
      }
    };
    
    const draw = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confetti.forEach((p, i) => {
        p.vy += 0.1; // gravity
        p.y += p.vy;
        p.x += p.vx;
        p.angle += p.spin;
        p.opacity -= 0.005;

        if (p.y > canvas.height || p.opacity <= 0) {
            confetti.splice(i, 1);
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
        ctx.restore();
      });

      if (confetti.length > 0) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    setup();
    draw();
    
    const handleResize = () => {
        if (!canvas || !canvas.parentElement) return;
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);


    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />;
};

export default WinnerConfetti;
