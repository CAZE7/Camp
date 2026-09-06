/**
 * WP-3 (#391): Routing Rules (Schicht 2) + Domain Rules (Schicht 3).
 * ELK-Pass (WP-4) und A*-Pass (WP-6) konsumieren ausschließlich dieses Modul.
 */
export * from './collision';
export * from './laneRegistry';
export * from './costModel';
export * from './portFanOut';
