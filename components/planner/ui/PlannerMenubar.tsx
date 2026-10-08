'use client';

import React, { useEffect, useId, useRef } from 'react';
import type { PlannerMenuGroup, PlannerMenuId, PlannerMenus } from '../hooks/usePlannerActions';

/**
 * Menüleiste der Planer-Anwendung (klassische Anwendungsstruktur).
 *
 * Sie ist bewusst keine Navigationsleiste einer Webseite: links der Werkzeug-
 * name und das offene Projekt, dann Menüs mit Textlabels, rechts der
 * Speicherzustand. Primäre Aktionen liegen in der Werkzeugleiste darunter,
 * sekundäre in genau diesen Menüs — nicht als Knopfreihe nebeneinander.
 */

export interface PlannerMenubarProps {
  menus: PlannerMenus;
  /** Name des offenen Plans (Kopfzeile zeigt ihn wie ein Dateiname). */
  projectName: string;
  openMenu: PlannerMenuId | null;
  onOpenMenu: (menu: PlannerMenuId | null) => void;
  /** Rechts: Speicherzustand als Text (kein Farb-Badge). */
  status: React.ReactNode;
}

const MENU_ORDER: PlannerMenuId[] = ['datei', 'bearbeiten', 'ansicht', 'werkzeuge', 'planung', 'hilfe'];

const MENU_LABELS: Record<PlannerMenuId, string> = {
  datei: 'Datei',
  bearbeiten: 'Bearbeiten',
  ansicht: 'Ansicht',
  werkzeuge: 'Werkzeuge',
  planung: 'Planung',
  hilfe: 'Hilfe',
};

function MenuDropdown({
  id,
  groups,
  onClose,
}: {
  id: string;
  groups: PlannerMenuGroup[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Fokus in den ersten Eintrag: Tastaturbedienung ist der Normalfall in
  // technischen Anwendungen (Alt-unabhängig über die Menüleiste erreichbar).
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, []);

  return (
    <div ref={ref} id={id} role="menu" aria-label="Menü" className="cad-menu">
      {groups.map((group, index) => (
        <React.Fragment key={group.label ?? `g${index}`}>
          {index > 0 && <div className="cad-menu__sep" role="separator" />}
          {group.label && <p className="cad-menu__label">{group.label}</p>}
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                {...(item.testId ? { 'data-testid': item.testId } : {})}
                disabled={item.disabled}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                className={`cad-menu__item ${item.danger ? 'text-destructive' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.checked && (
                  <span className="cad-menu__check" aria-hidden="true">
                    ◆
                  </span>
                )}
                {item.hint && <span className="cad-menu__hint">{item.hint}</span>}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export function PlannerMenubar({ menus, projectName, openMenu, onOpenMenu, status }: PlannerMenubarProps) {
  const baseId = useId();
  const barRef = useRef<HTMLDivElement>(null);

  // Klick außerhalb schließt, Escape ebenso — Standardverhalten von Menüleisten.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) onOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu, onOpenMenu]);

  return (
    <div ref={barRef} className="cad-menubar" role="menubar" aria-label="Hauptmenü des Planers">
      <span className="cad-menubar__brand">
        Werft
        <span className="cad-menubar__project-name" title="Automatisch lokal gespeicherter Plan">
          {projectName}
        </span>
      </span>

      <div className="cad-menubar__menus">
        {MENU_ORDER.map((menu) => {
          const open = openMenu === menu;
          return (
            <div key={menu} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={`${baseId}-${menu}`}
                data-open={open ? 'true' : 'false'}
                data-testid={`menubar-${menu}`}
                onClick={() => onOpenMenu(open ? null : menu)}
                className="cad-menubar__item"
              >
                {MENU_LABELS[menu]}
              </button>
              {open && (
                <MenuDropdown
                  id={`${baseId}-${menu}`}
                  groups={menus[menu]}
                  onClose={() => onOpenMenu(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="cad-menubar__status">{status}</div>
    </div>
  );
}
