import React, { useState, useEffect, useRef } from 'react';
import { Leaf } from 'lucide-react';

export const FloatingLeaf: React.FC = () => {
  const [leafPosition, setLeafPosition] = useState({ x: 20, y: 20 });
  const [leafRotation, setLeafRotation] = useState(0);
  const animationRef = useRef<number>();
  const positionRef = useRef({ x: 20, y: 20 });
  const velocityRef = useRef({ x: 1.2, y: 0.9 });
  const rotationRef = useRef(0);

  useEffect(() => {
    const animateLeaf = () => {
      // Update position
      positionRef.current.x += velocityRef.current.x;
      positionRef.current.y += velocityRef.current.y;
      
      // Get window dimensions
      const maxX = window.innerWidth - 40; // leaf size
      const maxY = window.innerHeight - 40;
      
      // Bounce off edges
      if (positionRef.current.x <= 0 || positionRef.current.x >= maxX) {
        velocityRef.current.x = -velocityRef.current.x;
        positionRef.current.x = Math.max(0, Math.min(positionRef.current.x, maxX));
      }
      if (positionRef.current.y <= 0 || positionRef.current.y >= maxY) {
        velocityRef.current.y = -velocityRef.current.y;
        positionRef.current.y = Math.max(0, Math.min(positionRef.current.y, maxY));
      }
      
      // Slowly rotate the leaf
      rotationRef.current = (rotationRef.current + 0.5) % 360;
      
      // Update state
      setLeafPosition({ x: positionRef.current.x, y: positionRef.current.y });
      setLeafRotation(rotationRef.current);
      
      animationRef.current = requestAnimationFrame(animateLeaf);
    };

    animationRef.current = requestAnimationFrame(animateLeaf);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      className="absolute pointer-events-none z-0 will-change-transform"
      style={{
        transform: `translate3d(${leafPosition.x}px, ${leafPosition.y}px, 0) rotate(${leafRotation}deg)`,
      }}
    >
      <Leaf className="w-10 h-10 text-primary/20" strokeWidth={1.5} />
    </div>
  );
};
