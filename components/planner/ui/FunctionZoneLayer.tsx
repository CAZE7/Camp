import { memo, useMemo } from 'react';
import { useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import type { FunctionZone } from '../utils/functionZones';

/**
 * Funktionszonen-Hintergrund (B3): dezente Stufen-Bänder in Flow-Koordinaten
 * unterhalb aller Nodes/Kanten. Das SVG liegt im React-Flow-Root und folgt
 * Pan/Zoom über dieselbe Transform wie der Viewport (`translate+scale`);
 * die Band-Chips sind Screen-konstant, damit sie in jedem Zoom lesbar bleiben.
 *
 * Stacking: SVG z-index 1 → unter `.react-flow__renderer` (z-index 4, darin
 * Nodes/Kanten), über Punkt-Raster (z-index −1) und Canvas-Fläche.
 *
 * Bänder folgen den IST-Positionen der Bauteile (`computeFunctionZones`):
 * Beim Verschieben eines Bauteils wandert seine Zone mit — das Hintergrundbild
 * lügt nie über die tatsächliche Anordnung.
 */

const chipClass = 'label-eyebrow planner-zone-chip whitespace-nowrap';

function ZoneLayerInner({ zones }: { zones: readonly FunctionZone[] }) {
  // RF-Store: Viewport als [translateX, translateY, zoom]-Tripel.
  const transform = useStore(useShallow((state) => state.transform));
  const viewport = useStore(useShallow((state) => ({ width: state.width, height: state.height })));

  const svgTransform = useMemo(
    () => `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
    [transform]
  );

  if (zones.length === 0) return null;

  const [tx, ty, zoom] = transform;

  return (
    <>
      <svg
        aria-hidden="true"
        className="planner-zone-layer"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <g style={{ transform: svgTransform, transformOrigin: '0 0' }}>
          {zones.map((zone) => (
            <g key={`${zone.key}:${zone.x.toFixed(1)}`}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx={4}
                fill="var(--zone-fill)"
              />
              {/* 1-px-Kante am Bandanfang (links) als Zonen-Markierung. */}
              <rect x={zone.x} y={zone.y} width={2} height={zone.height} fill="var(--zone-edge)" />
            </g>
          ))}
        </g>
      </svg>
      {/* Chips in Screen-Koordinaten: Flow-Position × Zoom + Pan. Nur im
          sichtbaren Ausschnitt rendern (Canvas-Root schneidet nicht selbst). */}
      {zones.map((zone) => {
        const bandTopY = ty + zone.y * zoom;
        const cx = tx + (zone.x + zone.width / 2) * zoom;
        if (cx < -40 || cx > viewport.width + 40 || bandTopY < -40 || bandTopY > viewport.height + 40) {
          return null;
        }
        return (
          <div
            key={`label:${zone.key}`}
            aria-hidden="true"
            className={chipClass}
            style={{
              position: 'absolute',
              left: cx,
              top: bandTopY,
              transform: 'translate(-50%, -100%)',
              marginTop: -4,
              zIndex: 1,
              padding: '2px 7px',
              pointerEvents: 'none',
            }}
          >
            {zone.label}
          </div>
        );
      })}
    </>
  );
}

/** Memo: Zonen ändern sich nur mit Knotenpositionen/Viewport, nicht mit Hover. */
export const FunctionZoneLayer = memo(ZoneLayerInner);
