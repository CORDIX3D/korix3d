import Image, { type ImageProps } from 'next/image';

type OptimizedImageProps = Omit<ImageProps, 'width' | 'height'> & {
  width?: number;
  height?: number;
};

export function OptimizedImage({ src, alt, width = 1200, height = 800, sizes = '(max-width: 768px) 100vw, 50vw', ...props }: OptimizedImageProps) {
  let unoptimized = false;

  if (typeof src === 'string' && /^https?:\/\//.test(src)) {
    try {
      const hostname = new URL(src).hostname;
      unoptimized = !hostname.endsWith('.supabase.co') && hostname !== 'korix3d.pl' && hostname !== 'www.korix3d.pl';
    } catch {
      unoptimized = true;
    }
  }

  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized={unoptimized} {...props} />;
}
