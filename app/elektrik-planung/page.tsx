import Planner from '../../components/Planner';

export default function ElektrikPlanung() {
  return (
    <main id="main" className="relative flex min-h-0 w-full flex-1 flex-col bg-paper font-sans">
      <h1 className="sr-only">Elektrik-Planer</h1>
      <Planner />
    </main>
  );
}
