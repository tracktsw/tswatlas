import { useEffect, useState, memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  type: 'sparkle' | 'heart' | 'circle';
}

interface SparkleEffectProps {
  isActive: boolean;
  onComplete?: () => void;
  className?: string;
}

const colors = [
  'hsl(12, 70%, 62%)',    // coral
  'hsl(42, 80%, 70%)',    // honey
  'hsl(145, 28%, 42%)',   // sage/primary
  'hsl(15, 50%, 55%)',    // terracotta
  'hsl(45, 60%, 85%)',    // cream
];

// Memoized particle component to prevent unnecessary re-renders
const SparkleParticle = memo(({ particle }: { particle: Particle }) => {
  // Pre-compute styles to avoid recalculation during animation
  const style = useMemo(() => ({
    left: `${particle.x}%`,
    top: `${particle.y}%`,
    width: particle.size,
    height: particle.size,
    '--duration': `${particle.duration}s`,
    animationDelay: `${particle.delay}s`,
    transform: 'translate3d(0, 0, 0)', // Force GPU layer
  } as React.CSSProperties), [particle]);

  if (particle.type === 'heart') {
    return (
      <svg
        className="absolute animate-sparkle-float pointer-events-none"
        style={style}
        viewBox="0 0 24 24"
        fill={particle.color}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }

  if (particle.type === 'sparkle') {
    return (
      <svg
        className="absolute animate-sparkle-burst pointer-events-none"
        style={style}
        viewBox="0 0 24 24"
        fill={particle.color}
      >
        <path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" />
      </svg>
    );
  }

  return (
    <div
      className="absolute rounded-full animate-sparkle-pop pointer-events-none"
      style={{
        ...style,
        backgroundColor: particle.color,
      }}
    />
  );
});

SparkleParticle.displayName = 'SparkleParticle';

// Pre-generate random values to avoid runtime Math.random during render
const generateParticles = (): Particle[] => {
  const types: Particle['type'][] = ['sparkle', 'heart', 'circle'];
  const particles: Particle[] = [];
  
  // Reduced from 20 to 15 particles for better performance
  for (let i = 0; i < 15; i++) {
    particles.push({
      id: i,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      size: 14 + Math.random() * 16, // Slightly smaller range
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3, // Reduced delay spread
      duration: 0.7 + Math.random() * 0.4, // Faster animations
      type: types[Math.floor(Math.random() * types.length)],
    });
  }
  
  return particles;
};

export const SparkleEffect = memo(({ isActive, onComplete, className }: SparkleEffectProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (isActive) {
      // Generate particles once when activated
      const newParticles = generateParticles();
      setParticles(newParticles);
      
      // Use requestAnimationFrame for smoother cleanup timing
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          setParticles([]);
          onComplete?.();
        });
      }, 1500); // Reduced from 2000ms
      
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  if (!isActive && particles.length === 0) return null;

  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 pointer-events-none overflow-hidden',
        className
      )}
      style={{ 
        contain: 'strict', // Enable CSS containment for performance
        willChange: 'contents',
      }}
    >
      {particles.map((particle) => (
        <SparkleParticle key={particle.id} particle={particle} />
      ))}
    </div>
  );
});

SparkleEffect.displayName = 'SparkleEffect';
