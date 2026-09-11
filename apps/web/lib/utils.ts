/**
 * Class name helper.
 *
 * The shadcn generator emits components that import `cn` from the published `cn`
 * package rather than from this alias, and `components.json` no longer redirects
 * that. Re-exporting keeps a single implementation behind both import paths, so
 * local code and generated components cannot diverge.
 */
export { cn } from 'cn';
