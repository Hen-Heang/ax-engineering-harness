import type { DetailSection } from '@/lib/definitions';

export function DefinitionSections({ sections }: { sections: DetailSection[] }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map(section => (
        <div key={section.label} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {section.label}
          </h3>
          {section.ordered === true ? (
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm marker:text-muted-foreground">
              {section.items.map(item => <li key={item} className="text-pretty">{item}</li>)}
            </ol>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {section.items.map(item => <li key={item} className="text-pretty">{item}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
