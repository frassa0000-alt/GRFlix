import React from 'react';

interface MashhadLogoProps {
  className?: string;
  roundedClassName?: string;
  alt?: string;
}

export const MASHHAD_LOGO_SRC =
  '/assets/aistudio/a9ba060262df0bc9c49de07bf8a1f622_fd8ce206.jpg';

export const MashhadLogo: React.FC<MashhadLogoProps> = ({
  className = 'w-8 h-8',
  roundedClassName = 'rounded-xl',
  alt = 'MASHHAD',
}) => (
  <span
    className={`relative inline-flex items-center justify-center overflow-hidden bg-[#c8141a] shrink-0 select-none ${roundedClassName} ${className}`}
  >
    <img
      src={MASHHAD_LOGO_SRC}
      alt={alt}
      draggable={false}
      className="w-full h-full object-cover scale-[1.12] pointer-events-none"
    />
  </span>
);
