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
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.clearRect(-canvas.width/2, -canvas.height/2, canvas.width, canvas.height);

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

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10" />;
};

export default DynamicBackground;
