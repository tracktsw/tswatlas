import { useState, useEffect, useRef } from 'react';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*';

interface ScrambledTextProps {
  /** The fake text length or template string (real value is never shown) */
  length?: number;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

const ScrambledText = ({ length = 6, className = '', as: Tag = 'span' }: ScrambledTextProps) => {
  const [text, setText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const scramble = () => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setText(result);
    };
    scramble();
    intervalRef.current = setInterval(scramble, 80);
    return () => clearInterval(intervalRef.current);
  }, [length]);

  return (
    <Tag className={`font-mono inline-block ${className}`} aria-hidden="true">
      {text}
    </Tag>
  );
};

export default ScrambledText;
