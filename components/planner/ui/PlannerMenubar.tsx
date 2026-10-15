'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import type { PlannerMenuGroup, PlannerMenuId, PlannerMenus } from '../hooks/usePlannerActions';
import { handleMenuKeyDown } from './menuKeyboard';

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
  onClose: (restoreFocus?: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Fokus in den ersten Eintrag: Tastaturbedienung ist der Normalfall in
  // technischen Anwendungen (Alt-unabhängig über die Menüleiste erreichbar).
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label="Menü"
      /* Auf dem Handy als Blatt über der Fußleiste (`planner-menubar-sheet`):
         Der Auslöser steht dort in einer waagerecht scrollenden Reihe, ein
         Dropdown an seinem Rand läge außerhalb des Fensters. */
      className="cad-menu planner-menubar-sheet left-0"
      onKeyDown={(event) => handleMenuKeyDown(event, onClose)}
    >
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
                  onClose(true);
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
  const triggerRefs = useRef(new Map<PlannerMenuId, HTMLButtonElement>());
  const closeMenu = useCallback(
    (restoreFocus = false) => {
      const activeMenu = openMenu;
      onOpenMenu(null);
      if (restoreFocus && activeMenu) triggerRefs.current.get(activeMenu)?.focus();
    },
    [openMenu, onOpenMenu]
  );

  // Klick außerhalb schließt, Escape schließt und stellt den Fokus wieder her.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeMenu(true);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu, closeMenu]);

  return (
    /* `barRef` bleibt auf der Titelleiste: Sie ist der Bezug für „Klick
       außerhalb schließt das Menü" und muss die Dropdowns einschließen. */
    <div ref={barRef} className="cad-menubar">
      <span className="cad-menubar__brand">
        {/* Wortmarke als Weg zurück auf die Website: Die Anwendungsroute
            (`/planer/`) trägt bewusst keine Kopfleiste der Website, weil sie
            der Zeichenfläche Fensterhöhe kosten würde. Der Ausgang liegt dafür
            dort, wo ihn jede Anwendung hat — auf der Marke in der Titelleiste. */}
        <Link href="/" className="cad-menubar__home" title="Elektroplaner — zur Startseite">
          Elektroplaner
        </Link>
        <span className="cad-menubar__project-name" title="Automatisch lokal gespeicherter Plan">
          {projectName}
        </span>
      </span>

      {/*
        `role="menubar"` sitzt auf der Menüreihe, nicht auf der ganzen Leiste.
        Eine Menubar darf nur `menuitem` (bzw. `group`) besitzen — Marke und
        Speicherzustand gehören nicht dazu. Lag die Rolle auf dem Rahmen, war
        der Home-Link ein `link`-Kind einer `menubar`: axe meldet das als
        `aria-required-children` mit Impact `critical` (gemessen auf `/planer/`,
        WCAG 1.3.1, alle vier Viewports). Rollen ändern nichts am Layout, die
        CSS-Klassen bleiben dieselben.
      */}
      <div className="cad-menubar__menus" role="menubar" aria-label="Hauptmenü des Planers">
        {MENU_ORDER.map((menu) => {
          const open = openMenu === menu;
          return (
            <div
              key={menu}
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu();
              }}
            >
              <button
                ref={(element) => {
                  if (element) triggerRefs.current.set(menu, element);
                  else triggerRefs.current.delete(menu);
                }}
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
              {open && <MenuDropdown id={`${baseId}-${menu}`} groups={menus[menu]} onClose={closeMenu} />}
            </div>
          );
        })}
      </div>

      <div className="cad-menubar__status">{status}</div>
    </div>
  );
}
