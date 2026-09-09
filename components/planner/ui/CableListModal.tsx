'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Cable, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { computeValidationWarnings, type ValidationWarning } from '../hooks/useLiveValidation';
import {
  type CableRow,
  buildCableRows,
  DOMAIN_LABEL,
  rowCrossSectionLabel,
  rowFuseLabel,
  rowLengthMeters,
  rowStatus,
  STATUS_ORDER,
  type RowStatus,
} from '../utils/cableRows';

type SortKey = 'von' | 'nach' | 'funktion' | 'adern' | 'quer' | 'laenge' | 'schutz' | 'status';
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: 'von', label: 'Von' },
  { key: 'nach', label: 'Nach' },
  { key: 'funktion', label: 'Funktion' },
  { key: 'adern', label: 'Adern', className: 'text-right' },
  { key: 'quer', label: 'mm²', className: 'text-right' },
  { key: 'laenge', label: 'Länge', className: 'text-right' },
  { key: 'schutz', label: 'Sicherung / Stromkreis' },
  { key: 'status', label: 'Status' },
];

const STATUS_META: Record<RowStatus, { label: string; className: string; title: string }> = {
  critical: {
    label: 'Kritisch',
    className: 'bg-warn-critical text-on-signal',
    title: 'Zeile hat kritische Warnungen',
  },
  warning: {
    label: 'Warnung',
    className: 'bg-warn-warning text-on-signal',
    title: 'Zeile hat Warnungen',
  },
  info: {
    label: 'Hinweis',
    className: 'bg-warn-info text-on-signal',
    title: 'Zeile hat Hinweise',
  },
  ok: { label: 'OK', className: 'bg-surface-raised text-muted-foreground', title: 'Keine Warnungen' },
};

const DOMAIN_CLASS: Record<string, string> = {
  DC_12V: 'bg-oxide/15 text-oxide',
  AC_230V: 'bg-warn-critical/15 text-warn-critical',
  Solar: 'bg-warn-info/15 text-warn-info',
  mixed: 'bg-accent text-muted-foreground',
};

const POLARITY_LABEL: Record<string, string> = {
  pair: 'Plus/Minus',
  plus: 'Plus',
  minus: 'Minus',
};

function domainLabelOf(domain: CableRow['domain']): string {
  if (domain === undefined) return '—';
  if (domain === 'mixed') return 'Verschieden';
  return DOMAIN_LABEL[domain];
}

const statusOfWarningType = (type: ValidationWarning['type']): RowStatus =>
  type === 'critical' ? 'critical' : type === 'warning' ? 'warning' : 'info';

function SortButton({
  column,
  sortKey,
  sortDir,
  onSort,
  children,
}: {
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (column: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Nach „${children}“ sortieren${active ? `, aktuell ${sortDir === 'asc' ? 'aufsteigend' : 'absteigend'}` : ''}`}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="inline-flex min-h-11 items-center gap-1 px-1 text-xs font-bold uppercase tracking-wide text-foreground hover:text-oxide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      {active ? (
        sortDir === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )
      ) : (
        <span className="inline-block w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function compareValues(a: unknown, b: unknown): number {
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'de');
}

function sortedRows(rows: CableRow[], sortKey: SortKey, sortDir: SortDir, search: string): CableRow[] {
  const query = search.trim().toLocaleLowerCase('de');
  const filtered = query
    ? rows.filter((row) =>
        [row.fromLabel, row.toLabel, rowFuseLabel(row), domainLabelOf(row.domain)].some((text) =>
          text.toLocaleLowerCase('de').includes(query)
        )
      )
    : rows;
  const factor = sortDir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    let result = 0;
    switch (sortKey) {
      case 'von':
        result = compareValues(a.fromLabel, b.fromLabel);
        break;
      case 'nach':
        result = compareValues(a.toLabel, b.toLabel);
        break;
      case 'funktion': {
        const da = a.domain === 'mixed' ? 'mixed' : (a.domain ?? '');
        const db = b.domain === 'mixed' ? 'mixed' : (b.domain ?? '');
        result = compareValues(da, db) || compareValues(a.polarity ?? '', b.polarity ?? '');
        break;
      }
      case 'adern':
        result = compareValues(a.cores, b.cores);
        break;
      case 'quer': {
        const minA = a.crossSections[0] ?? Number.MAX_SAFE_INTEGER;
        const minB = b.crossSections[0] ?? Number.MAX_SAFE_INTEGER;
        result = minA - minB;
        break;
      }
      case 'laenge': {
        const la = rowLengthMeters(a) ?? Number.MAX_SAFE_INTEGER;
        const lb = rowLengthMeters(b) ?? Number.MAX_SAFE_INTEGER;
        result = la - lb;
        break;
      }
      case 'schutz':
        result = compareValues(rowFuseLabel(a), rowFuseLabel(b));
        break;
      case 'status': {
        const sa = rowStatus(a, new Map());
        const sb = rowStatus(b, new Map());
        result = (STATUS_ORDER[sa] ?? 3) - (STATUS_ORDER[sb] ?? 3);
        break;
      }
    }
    if (result === 0) result = compareValues(a.key, b.key);
    return result * factor;
  });
}

interface CableListSnapshot {
  rows: CableRow[];
  warnings: ValidationWarning[];
}

export function CableListModal() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<CableListSnapshot | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('von');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleOpen = () => {
      // Snapshot beim Öffnen (wie das BOM-Modal): Während das Modal offen
      // ist, kann der Plan nicht verändert werden — ein Live-Abo wäre Last
      // ohne Nutzen.
      const { nodes, edges } = usePlannerStore.getState();
      setSnapshot({ rows: buildCableRows(nodes, edges), warnings: computeValidationWarnings(nodes, edges) });
      setSearch('');
      setSortKey('von');
      setSortDir('asc');
      setOpen(true);
    };
    window.addEventListener('show-cable-list', handleOpen);
    return () => window.removeEventListener('show-cable-list', handleOpen);
  }, []);

  const rows = useMemo(() => snapshot?.rows ?? [], [snapshot]);
  const warnings = useMemo(() => snapshot?.warnings ?? [], [snapshot]);

  const byEdgeId = useMemo(() => {
    const map = new Map<string, RowStatus>();
    for (const warning of warnings) {
      if (warning.focusType !== 'edge' || warning.focusId === undefined) continue;
      const status = statusOfWarningType(warning.type);
      const current = map.get(warning.focusId);
      if (current === undefined || STATUS_ORDER[status] < STATUS_ORDER[current]) {
        map.set(warning.focusId, status);
      }
    }
    return map;
  }, [warnings]);

  const visible = useMemo(() => sortedRows(rows, sortKey, sortDir, search), [rows, sortKey, sortDir, search]);

  const toggleSort = (column: SortKey) => {
    if (column === sortKey) {
      setSortDir((previous) => (previous === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column);
      setSortDir('asc');
    }
  };

  const handleRowClick = (row: CableRow) => {
    usePlannerStore.getState().focusElement(row.representativeEdgeId, 'edge');
    setOpen(false);
  };

  const empty = rows.length === 0;

  return (
    <AccessibleDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Kabelliste"
      description="Alle elektrischen Leitungen des Plans. Klick auf eine Zeile wählt die Leitung im Plan und blendet den Rest aus. Sortieren per Spaltenkopf; Suche filtert."
      className="max-w-6xl"
    >
      <div className="flex flex-col gap-3 overflow-hidden p-4 sm:p-5">
        {empty ? (
          <div className="rounded-lg border border-border bg-accent p-6 text-center">
            <Cable className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 font-semibold">Noch keine Leitungen.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Verbinde Bauteile oder starte „Automatisch verbinden“ — dann entsteht hier die Liste.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {visible.length} von {rows.length} Leitungen
              </p>
              <label className="relative block w-full sm:w-72">
                <span className="sr-only">Leitungen durchsuchen</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Von, Nach, Funktion, Sicherung …"
                  className="min-h-11 w-full rounded border border-border bg-card py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Suche leeren"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <caption className="sr-only">Kabelliste des Plans</caption>
                <thead className="border-b border-border bg-accent">
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} scope="col" className={`px-2 py-1 ${column.className ?? ''}`}>
                        <SortButton
                          column={column.key}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={toggleSort}
                        >
                          {column.label}
                        </SortButton>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const status = rowStatus(row, byEdgeId);
                    const meta = STATUS_META[status];
                    const domain = row.domain ?? 'DC_12V';
                    const domainClass = DOMAIN_CLASS[domain] ?? DOMAIN_CLASS.DC_12V;
                    return (
                      <tr
                        key={row.key}
                        data-testid={`cable-row-${row.key}`}
                        onClick={() => handleRowClick(row)}
                        className="cursor-pointer border-b border-border/60 bg-card transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleRowClick(row);
                          }
                        }}
                      >
                        <td className="max-w-56 px-2 py-3 align-top">
                          <span className="block truncate font-medium text-foreground" title={row.fromLabel}>
                            {row.fromLabel}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{row.fromId}</span>
                        </td>
                        <td className="max-w-56 px-2 py-3 align-top">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <ArrowRight
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="truncate" title={row.toLabel}>
                              {row.toLabel}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{row.toId}</span>
                        </td>
                        <td className="px-2 py-3 align-top">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${domainClass}`}
                          >
                            {DOMAIN_LABEL[domain === 'mixed' ? 'DC_12V' : domain] ?? domain}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {POLARITY_LABEL[row.polarity ?? ''] ?? ''}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right font-mono text-foreground">{row.cores}</td>
                        <td className="px-2 py-3 text-right font-mono text-foreground">
                          {rowCrossSectionLabel(row)}
                        </td>
                        <td className="px-2 py-3 text-right font-mono text-foreground">
                          {(() => {
                            const meters = rowLengthMeters(row);
                            return meters === undefined ? '—' : `${meters.toFixed(1)} m`;
                          })()}
                        </td>
                        <td className="px-2 py-3 font-mono text-xs text-foreground">{rowFuseLabel(row)}</td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 && (
              <p className="rounded-lg border border-border bg-accent p-4 text-center text-sm text-muted-foreground">
                Keine Leitung passt zur Suche.
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button onClick={() => setOpen(false)} className="min-h-11">
          Schließen
        </Button>
      </div>
    </AccessibleDialog>
  );
}
