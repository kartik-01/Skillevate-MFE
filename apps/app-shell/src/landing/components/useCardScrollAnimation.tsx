import { useEffect, useRef, useState } from 'react';

export function useCardScrollAnimation(index: number, _totalCards: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    
    const triggerAnimation = () => {
      if (hasTriggered.current) return;
      hasTriggered.current = true;
      
      const delay = isMobile ? 0 : index * 300;
      setTimeout(() => {
        setIsVisible(true);
      }, delay);
    };
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          triggerAnimation();
          observer.disconnect();
        }
      },
      {
        threshold: isMobile ? 0.2 : 0.1,
        rootMargin: isMobile ? '-50px' : '200px',
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
      
      // Check if element is already in viewport after layout settles
      requestAnimationFrame(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          const windowHeight = window.innerHeight || document.documentElement.clientHeight;
          const isInViewport = rect.top < windowHeight + 200 && rect.bottom > 0;
          
          if (isInViewport) {
            triggerAnimation();
            observer.disconnect();
          }
        }
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [index]);

  return { ref, isVisible };
}
