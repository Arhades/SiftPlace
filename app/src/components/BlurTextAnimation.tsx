import { useEffect, useState, useMemo } from "react";

interface WordData {
  text: string;
  duration: number;
  delay: number;
  blur: number;
  scale?: number;
}

interface BlurTextAnimationProps {
  text?: string;
  words?: WordData[];
  className?: string;
  fontSize?: string;
  fontFamily?: string;
  textColor?: string;
  animationDelay?: number;
}

export default function BlurTextAnimation({
  text = "Smart student housing matcher ranked by true monthly cost.",
  words,
  className = "",
  fontSize = "text-3xl sm:text-4xl md:text-5xl font-bold",
  fontFamily = "font-display",
  textColor = "text-ink",
  animationDelay = 200
}: BlurTextAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const textWords = useMemo(() => {
    if (words) return words;
    
    const splitWords = text.split(" ");
    const totalWords = splitWords.length;
    
    return splitWords.map((word, index) => {
      const progress = index / totalWords;
      const exponentialDelay = Math.pow(progress, 0.8) * 0.5;
      const baseDelay = index * 0.06;
      const microVariation = (Math.random() - 0.5) * 0.05;
      
      return {
        text: word,
        duration: 2.2 + Math.cos(index * 0.3) * 0.3,
        delay: baseDelay + exponentialDelay + microVariation,
        blur: 12 + Math.floor(Math.random() * 8),
        scale: 0.9 + Math.sin(index * 0.2) * 0.05
      };
    });
  }, [text, words]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, animationDelay);

    return () => {
      clearTimeout(timer);
    };
  }, [textWords, animationDelay]);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="text-center w-full max-w-4xl">
        <p className={`${textColor} ${fontSize} ${fontFamily} leading-tight tracking-tight`}>
          {textWords.map((word, index) => (
            <span
              key={index}
              className={`inline-block transition-all ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
              style={{
                transitionDuration: `${word.duration}s`,
                transitionDelay: `${word.delay}s`,
                transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                filter: isAnimating 
                  ? 'blur(0px) brightness(1)' 
                  : `blur(${word.blur}px) brightness(0.6)`,
                transform: isAnimating 
                  ? 'translateY(0) scale(1) rotateX(0deg)' 
                  : `translateY(15px) scale(${word.scale || 1}) rotateX(-15deg)`,
                marginRight: '0.28em',
                willChange: 'filter, transform, opacity',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
                textShadow: isAnimating 
                  ? '0 2px 8px rgba(0,0,0,0.05)' 
                  : '0 0 40px rgba(0,0,0,0.1)'
              }}
            >
              {word.text}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
