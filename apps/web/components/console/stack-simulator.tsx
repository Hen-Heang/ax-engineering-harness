'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * The adoption simulator.
 *
 * It runs entirely from validated configuration compiled into the page. Selecting a
 * stack shows what that profile would resolve and which gates it could supply; it
 * starts nothing, resolves nothing at request time, and reaches no filesystem. The
 * shapes are declared locally so this client component never imports the harness.
 */

export interface SimulatedGateView {
  id: string;
  title: string;
  source: string;
  detail: string;
}

export interface SimulatedBuildSystemView {
  id: string;
  manifests: string[];
  runner: string;
  supplies: string[];
}

export interface SimulatedAreaView {
  id: string;
  title: string;
  path: string;
  profile: string;
  roles: string[];
}

export interface SimulationView {
  id: string;
  label: string;
  summary: string;
  status: string;
  buildSystems: SimulatedBuildSystemView[];
  areas: SimulatedAreaView[];
  gates: SimulatedGateView[];
  limitations: string[];
}

const sourceLabels: Record<string, string> = {
  profile: 'Supplied by the profile',
  project: 'The project must declare it',
  manual: 'A person decides',
  eval: 'Assesses behaviour',
};

export function StackSimulator({ simulations }: { simulations: SimulationView[] }) {
  const [selectedId, setSelectedId] = useState(simulations[0]?.id ?? '');
  const selected = simulations.find(simulation => simulation.id === selectedId) ?? simulations[0];

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Choose a stack" className="flex flex-wrap gap-2">
        {simulations.map(simulation => {
          const active = simulation.id === selected.id;
          return (
            <button
              key={simulation.id}
              type="button"
              onClick={() => setSelectedId(simulation.id)}
              aria-pressed={active}
              className={cn(
                'min-h-11 rounded-md border px-3.5 text-sm transition-colors',
                'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active && 'bg-muted font-medium',
              )}
            >
              {simulation.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-5 rounded-lg border bg-card px-4 py-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-sm">{selected.id}</code>
            <Badge variant="outline" className="font-normal capitalize">{selected.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground text-pretty">{selected.summary}</p>
        </div>

        {selected.buildSystems.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Build systems it detects
            </h3>
            <ul className="flex flex-col gap-1 text-sm">
              {selected.buildSystems.map(system => (
                <li key={system.id} className="text-pretty">
                  <span className="font-medium">{system.id}</span> — found by{' '}
                  {system.manifests.join(' or ')}, run via {system.runner}, supplies{' '}
                  {system.supplies.length > 0 ? system.supplies.join(', ') : 'nothing'}
                </li>
              ))}
            </ul>
          </section>
        )}

        {selected.areas.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Areas and the roles that own them
            </h3>
            <ul className="flex flex-col gap-1 text-sm">
              {selected.areas.map(area => (
                <li key={area.id} className="text-pretty">
                  <span className="font-medium">{area.path}/</span> resolved by {area.profile}, owned by{' '}
                  {area.roles.join(', ')}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quality gates
          </h3>
          <ul className="flex flex-col gap-px overflow-hidden rounded-md border bg-border">
            {selected.gates.map(gate => (
              <li key={gate.id} className="flex flex-col gap-1 bg-card px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="text-sm sm:w-40 sm:shrink-0">{gate.title}</span>
                <span className="text-sm text-muted-foreground text-pretty">
                  <span className="text-foreground">{sourceLabels[gate.source] ?? gate.source}.</span>{' '}
                  {gate.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What this profile does not establish
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {selected.limitations.map(limitation => (
              <li key={limitation} className="text-pretty">{limitation}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
