import { Package } from 'lucide-react';

type Props = {
  productName: string;
  imageUrl?: string;
  size?: number;
  onImageClick?: () => void;
};

export function VendorProductThumbnail({ productName, imageUrl, size = 40, onImageClick }: Props) {
  const initials = productName
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');

  if (imageUrl) {
    return (
      <button
        type="button"
        onClick={onImageClick}
        disabled={!onImageClick}
        title={onImageClick ? 'View larger photo' : productName}
        className={`rounded-md border border-border bg-muted shrink-0 p-0 overflow-hidden ${onImageClick ? 'cursor-zoom-in hover:ring-2 hover:ring-primary/40 transition-shadow' : ''}`}
      >
        <img
          src={imageUrl}
          alt={productName}
          width={size}
          height={size}
          className="object-cover block"
          loading="lazy"
        />
      </button>
    );
  }

  return (
    <div
      className="rounded-md border border-border bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground"
      style={{ width: size, height: size }}
      title={productName}
    >
      {initials ? (
        <span className="text-xs font-semibold text-foreground/70">{initials}</span>
      ) : (
        <Package size={size * 0.4} strokeWidth={1.5} />
      )}
    </div>
  );
}
