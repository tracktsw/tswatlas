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
    1: { scale: 0.6, flames: 2, speed: 1.2 },
    2: { scale: 0.75, flames: 3, speed: 1.0 },
    3: { scale: 0.9, flames: 4, speed: 0.8 },
    4: { scale: 1.0, flames: 5, speed: 0.6 },
  };

  const config = intensityConfig[intensity as keyof typeof intensityConfig];

  return (
    <div 
      className={cn("relative flex items-center justify-center", className)}
      style={{ transform: `scale(${config.scale})` }}
    >
      {/* Main flame container */}
      <div className="relative w-6 h-8">
        {/* Core flame */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-6 rounded-full"
          style={{
            background: 'linear-gradient(to top, #f97316, #fbbf24, #fef08a)',
            filter: 'blur(1px)',
            transformOrigin: 'bottom center',
          }}
          animate={{
            scaleY: [1, 1.15, 0.95, 1.1, 1],
            scaleX: [1, 0.9, 1.05, 0.95, 1],
          }}
          transition={{
            duration: config.speed,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Inner bright core */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-4 rounded-full"
          style={{
            background: 'linear-gradient(to top, #fbbf24, #fef9c3)',
            filter: 'blur(0.5px)',
            transformOrigin: 'bottom center',
          }}
          animate={{
            scaleY: [1, 1.2, 0.9, 1.15, 1],
            scaleX: [1, 0.85, 1.1, 0.9, 1],
          }}
          transition={{
            duration: config.speed * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Additional flames based on intensity */}
        {config.flames >= 3 && (
          <motion.div
            className="absolute bottom-0 left-0 w-3 h-4 rounded-full"
            style={{
              background: 'linear-gradient(to top, #ea580c, #f97316, #fbbf24)',
              filter: 'blur(1px)',
              transformOrigin: 'bottom center',
            }}
            animate={{
              scaleY: [0.8, 1.1, 0.85, 1, 0.8],
              scaleX: [1, 0.9, 1.1, 0.95, 1],
              rotate: [-5, -10, -3, -8, -5],
            }}
            transition={{
              duration: config.speed * 1.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {config.flames >= 3 && (
          <motion.div
            className="absolute bottom-0 right-0 w-3 h-4 rounded-full"
            style={{
              background: 'linear-gradient(to top, #ea580c, #f97316, #fbbf24)',
              filter: 'blur(1px)',
              transformOrigin: 'bottom center',
            }}
            animate={{
              scaleY: [0.85, 1, 0.9, 1.1, 0.85],
              scaleX: [1, 1.1, 0.9, 1, 1],
              rotate: [5, 10, 3, 8, 5],
            }}
            transition={{
              duration: config.speed * 0.9,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Outer flames for higher intensity */}
        {config.flames >= 4 && (
          <>
            <motion.div
              className="absolute bottom-0 -left-1 w-2.5 h-5 rounded-full opacity-80"
              style={{
                background: 'linear-gradient(to top, #dc2626, #f97316, #fbbf24)',
                filter: 'blur(1.5px)',
                transformOrigin: 'bottom center',
              }}
              animate={{
                scaleY: [0.7, 1.05, 0.8, 0.95, 0.7],
                rotate: [-15, -20, -10, -18, -15],
              }}
              transition={{
                duration: config.speed * 1.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-0 -right-1 w-2.5 h-5 rounded-full opacity-80"
              style={{
                background: 'linear-gradient(to top, #dc2626, #f97316, #fbbf24)',
                filter: 'blur(1.5px)',
                transformOrigin: 'bottom center',
              }}
              animate={{
                scaleY: [0.75, 0.95, 0.85, 1.05, 0.75],
                rotate: [15, 20, 10, 18, 15],
              }}
              transition={{
                duration: config.speed * 1.3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}

        {/* Maximum intensity - extra wild flames */}
        {config.flames >= 5 && (
          <>
            <motion.div
              className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-7 rounded-full opacity-60"
              style={{
                background: 'linear-gradient(to top, #b91c1c, #dc2626, #f97316)',
                filter: 'blur(2px)',
                transformOrigin: 'bottom center',
              }}
              animate={{
                scaleY: [0.9, 1.2, 0.85, 1.1, 0.9],
                scaleX: [1, 1.15, 0.9, 1.1, 1],
              }}
              transition={{
                duration: config.speed * 0.7,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Spark particles */}
            <motion.div
              className="absolute -top-1 left-1/2 w-1 h-1 rounded-full bg-yellow-300"
              animate={{
                y: [-2, -8, -2],
                x: [-1, 2, -1],
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
              className="absolute -top-0.5 left-1 w-0.5 h-0.5 rounded-full bg-orange-300"
              animate={{
                y: [-1, -6, -1],
                x: [1, -2, 1],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: config.speed * 1.8,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.2,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default StreakFire;
