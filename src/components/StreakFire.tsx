import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StreakFireProps {
  streak: number;
  className?: string;
}

const StreakFire = ({ streak, className }: StreakFireProps) => {
  // Only show fire when streak is 2 or more
  if (streak < 2) return null;

  // Determine fire intensity level based on streak
  const getIntensityLevel = () => {
    if (streak >= 10) return 4; // Maximum intensity
    if (streak >= 7) return 3;
    if (streak >= 4) return 2;
    return 1; // streak >= 2
  };

  const intensity = getIntensityLevel();

  // Glow and animation properties based on intensity
  const intensityConfig = {
    1: { glowSize: 8, glowOpacity: 0.4, speed: 2.5 },
    2: { glowSize: 12, glowOpacity: 0.5, speed: 2.2 },
    3: { glowSize: 16, glowOpacity: 0.6, speed: 1.8 },
    4: { glowSize: 20, glowOpacity: 0.7, speed: 1.5 },
  };

  const config = intensityConfig[intensity as keyof typeof intensityConfig];

  return (
    <div className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}>
      {/* Primary warm glow - positioned behind number */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: `calc(100% + ${config.glowSize * 2}px)`,
          height: `calc(100% + ${config.glowSize * 2}px)`,
          background: `radial-gradient(circle, rgba(251, 146, 60, ${config.glowOpacity}) 0%, rgba(249, 115, 22, ${config.glowOpacity * 0.6}) 40%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: config.speed,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary subtle pulse for depth */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: `calc(100% + ${config.glowSize * 1.5}px)`,
          height: `calc(100% + ${config.glowSize * 1.5}px)`,
          background: `radial-gradient(circle, rgba(251, 191, 36, ${config.glowOpacity * 0.5}) 0%, transparent 60%)`,
        }}
        animate={{
          scale: [1.05, 0.95, 1.05],
          opacity: [0.6, 0.9, 0.6],
        }}
        transition={{
          duration: config.speed * 0.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: config.speed * 0.2,
        }}
      />

      {/* Inner warm core for higher intensities */}
      {intensity >= 3 && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: `calc(100% + ${config.glowSize * 0.5}px)`,
            height: `calc(100% + ${config.glowSize * 0.5}px)`,
            background: `radial-gradient(circle, rgba(254, 240, 138, ${config.glowOpacity * 0.4}) 0%, transparent 50%)`,
          }}
          animate={{
            scale: [0.9, 1.1, 0.9],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: config.speed * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Subtle flickering sparks for max intensity */}
      {intensity >= 4 && (
        <>
          <motion.div
            className="absolute w-1 h-1 rounded-full bg-amber-300/60"
            style={{ top: '-4px', left: '30%' }}
            animate={{
              y: [0, -3, 0],
              opacity: [0, 0.8, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: config.speed * 0.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute w-1 h-1 rounded-full bg-orange-300/50"
            style={{ top: '-2px', right: '25%' }}
            animate={{
              y: [0, -4, 0],
              opacity: [0, 0.7, 0],
              scale: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: config.speed * 1.1,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.3,
            }}
          />
        </>
      )}
    </div>
  );
};

export default StreakFire;
