import Image from 'next/image';
import pottoIcon from '@/assets/web-icon-assets/icon-192.png';

export function BrandMark({
  subtitle,
  size = 'lg',
}: {
  subtitle?: string;
  size?: 'sm' | 'lg';
}) {
  const iconSize = size === 'lg' ? 56 : 32;
  const titleClass =
    size === 'lg'
      ? 'font-display text-5xl font-semibold tracking-tight text-accent'
      : 'font-display text-2xl font-semibold tracking-tight text-accent';

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <Image src={pottoIcon} alt="" width={iconSize} height={iconSize} priority />
        <p className={titleClass}>Potto</p>
      </div>
      {subtitle ? <p className="mt-2 text-ink-soft">{subtitle}</p> : null}
    </div>
  );
}
