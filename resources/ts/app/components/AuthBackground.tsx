import { useEffect, useState, ReactNode } from 'react';
import { Box } from '@mui/material';

const IMAGES = [
  '/images/bg1.jpg',
  '/images/bg2.jpg',
  '/images/bg3.jpg',
];

const OVERLAY =
  'linear-gradient(135deg, rgba(15,79,44,0.78) 0%, rgba(31,122,71,0.62) 50%, rgba(63,164,106,0.50) 100%)';

interface AuthBackgroundProps {
  children: ReactNode;
  intervalMs?: number;
}

export default function AuthBackground({ children, intervalMs = 5000 }: AuthBackgroundProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % IMAGES.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, md: 4 },
      }}
    >
      {/* Crossfading background images */}
      {IMAGES.map((src, i) => (
        <Box
          key={src}
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `${OVERLAY}, url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: index === i ? 1 : 0,
            transition: 'opacity 1.2s ease-in-out',
            zIndex: 0,
          }}
        />
      ))}

      {/* Decorative blurred shapes */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: { xs: -80, md: -120 },
          left: { xs: -80, md: -120 },
          width: { xs: 220, md: 360 },
          height: { xs: 220, md: 360 },
          background: 'radial-gradient(circle, rgba(217,164,65,0.35), transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          bottom: { xs: -100, md: -160 },
          right: { xs: -80, md: -120 },
          width: { xs: 240, md: 420 },
          height: { xs: 240, md: 420 },
          background: 'radial-gradient(circle, rgba(63,164,106,0.50), transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Carousel indicator dots */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 1,
          zIndex: 2,
        }}
      >
        {IMAGES.map((_, i) => (
          <Box
            key={i}
            onClick={() => setIndex(i)}
            sx={{
              width: index === i ? 24 : 8,
              height: 8,
              borderRadius: 4,
              bgcolor: index === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </Box>

      <Box sx={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </Box>
    </Box>
  );
}
