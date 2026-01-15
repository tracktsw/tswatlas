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

  // Scale and animation properties based on intensity
  const intensityConfig = {
    1: { scale: 0.7, flames: 2, speed: 1.2, height: 'h-10' },
    2: { scale: 0.85, flames: 3, speed: 1.0, height: 'h-12' },
    3: { scale: 1.0, flames: 4, speed: 0.8, height: 'h-14' },
    4: { scale: 1.1, flames: 5, speed: 0.6, height: 'h-16' },
  };

  const config = intensityConfig[intensity as keyof typeof intensityConfig];

  return (
    <div 
      className={cn("pointer-events-none", className)}
      style={{ transform: `scale(${config.scale})` }}
    >
      {/* Fire container - flames rise from behind the number */}
      <div className={cn("relative w-full flex items-end justify-center", config.height)}>
        {/* Left flame */}
        <motion.div
          className="absolute bottom-1 left-1/2 -translate-x-[130%] w-3 h-6 rounded-full opacity-90"
          style={{
            background: 'linear-gradient(to top, #ea580c, #f97316, #fbbf24)',
            filter: 'blur(1px)',
            transformOrigin: 'bottom center',
          }}
          animate={{
            scaleY: [0.8, 1.1, 0.85, 1, 0.8],
            scaleX: [1, 0.9, 1.1, 0.95, 1],
            rotate: [-8, -15, -5, -12, -8],
          }}
          transition={{
            duration: config.speed * 1.1,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Right flame */}
        <motion.div
          className="absolute bottom-1 left-1/2 translate-x-[30%] w-3 h-6 rounded-full opacity-90"
          style={{
            background: 'linear-gradient(to top, #ea580c, #f97316, #fbbf24)',
            filter: 'blur(1px)',
            transformOrigin: 'bottom center',
          }}
          animate={{
            scaleY: [0.85, 1, 0.9, 1.1, 0.85],
            scaleX: [1, 1.1, 0.9, 1, 1],
            rotate: [8, 15, 5, 12, 8],
          }}
          transition={{
            duration: config.speed * 0.9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Center back flame */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-8 rounded-full"
          style={{
            background: 'linear-gradient(to top, #f97316, #fbbf24, #fef08a)',
            filter: 'blur(1.5px)',
            transformOrigin: 'bottom center',
          }}
          animate={{
            scaleY: [1, 1.2, 0.9, 1.15, 1],
            scaleX: [1, 0.85, 1.1, 0.9, 1],
          }}
          transition={{
            duration: config.speed,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Additional outer flames for higher intensity */}
        {config.flames >= 3 && (
          <>
            <motion.div
              className="absolute bottom-1 left-1/2 -translate-x-[180%] w-2.5 h-5 rounded-full opacity-70"
              style={{
                background: 'linear-gradient(to top, #dc2626, #f97316, #fbbf24)',
                filter: 'blur(1.5px)',
                transformOrigin: 'bottom center',
              }}
              animate={{
                scaleY: [0.7, 1.05, 0.8, 0.95, 0.7],
                rotate: [-20, -28, -15, -24, -20],
              }}
              transition={{
                duration: config.speed * 1.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-1 left-1/2 translate-x-[80%] w-2.5 h-5 rounded-full opacity-70"
              style={{
                background: 'linear-gradient(to top, #dc2626, #f97316, #fbbf24)',
                filter: 'blur(1.5px)',
                transformOrigin: 'bottom center',
              }}
              animate={{
                scaleY: [0.75, 0.95, 0.85, 1.05, 0.75],
                rotate: [20, 28, 15, 24, 20],
              }}
              transition={{
                duration: config.speed * 1.3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}

        {/* Extra flames for intensity 4+ */}
        {config.flames >= 4 && (
          <>
            <motion.div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-10 rounded-full opacity-50"
              style={{
                background: 'linear-gradient(to top, #b91c1c, #dc2626, #f97316)',
                filter: 'blur(2px)',
                transformOrigin: 'bottom center',
              }}
              animate={{
                scaleY: [0.85, 1.15, 0.8, 1.1, 0.85],
                scaleX: [1, 1.1, 0.9, 1.05, 1],
              }}
              transition={{
                duration: config.speed * 0.7,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}

        {/* Maximum intensity - sparks */}
        {config.flames >= 5 && (
          <>
            <motion.div
              className="absolute top-0 left-1/2 -translate-x-1 w-1.5 h-1.5 rounded-full bg-yellow-300"
              animate={{
                y: [0, -8, 0],
                x: [-2, 3, -2],
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: config.speed * 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <motion.div
              className="absolute top-1 left-1/2 translate-x-1 w-1 h-1 rounded-full bg-orange-300"
              animate={{
                y: [0, -6, 0],
                x: [2, -2, 2],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: config.speed * 1.8,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.3,
              }}
            />
            <motion.div
              className="absolute top-2 left-1/2 w-1 h-1 rounded-full bg-yellow-200"
              animate={{
                y: [0, -10, 0],
                x: [0, -4, 0],
                opacity: [0, 0.9, 0],
                scale: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: config.speed * 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.5,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default StreakFire;
