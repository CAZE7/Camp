import Planner from '../components/Planner';
import Chat from '../components/Chat';

export default function Home() {
  return (
    <main className="w-full h-screen relative">
      <Planner />
      <Chat />
    </main>
  );
}
