import { Badge } from '@/components/ui/badge';
import type { CatalogStatus } from '@/lib/catalog';

const variants: Record<CatalogStatus | 'unspecified', 'default' | 'secondary' | 'outline'> = {
  implemented: 'default',
  experimental: 'secondary',
  planned: 'outline',
  unspecified: 'outline',
};

const labels: Record<CatalogStatus | 'unspecified', string> = {
  implemented: 'Implemented',
  experimental: 'Experimental',
  planned: 'Planned',
  unspecified: 'No status',
};

/**
 * Renders the status a definition declares.
 *
 * The label always comes from the definition, so a page cannot claim a maturity the
 * harness does not.
 */
export function StatusBadge({ status }: { status: CatalogStatus | 'unspecified' | null }) {
  const key = status ?? 'unspecified';
  return (
    <Badge variant={variants[key]} className="font-normal">
      {labels[key]}
    </Badge>
  );
}
