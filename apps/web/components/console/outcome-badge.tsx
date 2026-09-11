import { Badge } from '@/components/ui/badge';

type Outcome = 'passed' | 'failed' | 'unavailable' | 'unrun';

const variants: Record<Outcome, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  passed: 'default',
  failed: 'destructive',
  unavailable: 'outline',
  unrun: 'secondary',
};

/**
 * A gate outcome.
 *
 * The four outcomes are visually distinct, but the word is always present too, so the
 * distinction between a pass and an unrun gate never depends on colour alone.
 */
export function OutcomeBadge({ outcome }: { outcome: string }) {
  const key = (outcome in variants ? outcome : 'unrun') as Outcome;
  return (
    <Badge variant={variants[key]} className="font-normal">
      {key}
    </Badge>
  );
}
