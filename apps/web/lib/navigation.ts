import {
  BookOpen, Boxes, FlaskConical, History, Layers, ListChecks, Network,
  Plug, ShieldCheck, SquareCheckBig, Users, Waypoints,
  type LucideIcon,
} from 'lucide-react';

/**
 * The console's persistent navigation.
 *
 * A section is listed from the start so the shape of the product is visible, but an
 * item whose page does not exist yet carries no href and is rendered as unavailable
 * rather than as a link to a placeholder. The navigation therefore reports the
 * project's real progress instead of implying more than exists.
 */
export interface NavItem {
  label: string;
  /** Null until the page exists. Such an item is never a link. */
  href: string | null;
  icon: LucideIcon;
  /** Implementation phase that delivers the page. */
  phase: number;
}

export interface NavSection {
  /** Null for the leading group, which needs no heading. */
  label: string | null;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: null,
    items: [
      { label: 'Overview', href: '/', icon: Layers, phase: 8 },
      { label: 'Architecture', href: '/architecture', icon: Network, phase: 9 },
      { label: 'Workflow', href: '/workflow', icon: Waypoints, phase: 9 },
    ],
  },
  {
    label: 'Building blocks',
    items: [
      { label: 'Profiles', href: null, icon: Boxes, phase: 10 },
      { label: 'Agents', href: null, icon: Users, phase: 10 },
      { label: 'Skills', href: null, icon: ListChecks, phase: 10 },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { label: 'MCP & tools', href: null, icon: Plug, phase: 10 },
      { label: 'Policies', href: null, icon: ShieldCheck, phase: 10 },
    ],
  },
  {
    label: 'Quality',
    items: [
      { label: 'Quality gates', href: null, icon: SquareCheckBig, phase: 11 },
      { label: 'Evals', href: null, icon: FlaskConical, phase: 11 },
      { label: 'Runs', href: null, icon: History, phase: 11 },
    ],
  },
  {
    label: 'Adoption',
    items: [
      { label: 'Projects', href: null, icon: Boxes, phase: 11 },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Docs', href: null, icon: BookOpen, phase: 11 },
    ],
  },
];

export const navItems: NavItem[] = navigation.flatMap(section => section.items);

export const availableNavItems: NavItem[] = navItems.filter(item => item.href !== null);
