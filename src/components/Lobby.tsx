import React from 'react';
import { motion } from 'motion/react';
import { Satellite, Rocket } from 'lucide-react';

interface LobbyProps {
  onSelectMode: (mode: 'satellites' | 'launches') => void;
}

const Lobby: React.FC<LobbyProps> = ({ onSelectMode }) => {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center font-sans">
      {/* Background with stars (could be a static image or simple css stars) */}
      <div className="absolute inset-0 bg-[url('//unpkg.com/three-globe/example/img/night-sky.png')] opacity-50 z-0" />
      
      <div className="z-10 flex flex-col items-center gap-12 p-8 max-w-4xl w-full">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter mb-4">
            Orbit<span className="text-emerald-400">Watch</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-lg mx-auto">
            Explore the cosmos. Track real-time satellites or discover upcoming space missions.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {/* Satellite Card */}
          <motion.button
            whileHover={{ scale: 1.05, borderColor: 'rgba(16, 185, 129, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectMode('satellites')}
            className="group relative h-64 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-6 transition-colors hover:bg-zinc-800/80"
          >
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Satellite className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Satellite Tracker</h2>
              <p className="text-gray-400 text-sm">Real-time tracking of ISS, Starlink, and 2000+ objects.</p>
            </div>
          </motion.button>

          {/* Launch Card */}
          <motion.button
            whileHover={{ scale: 1.05, borderColor: 'rgba(244, 63, 94, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectMode('launches')}
            className="group relative h-64 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-6 transition-colors hover:bg-zinc-800/80"
          >
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
              <Rocket className="w-10 h-10 text-rose-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Launch Schedule</h2>
              <p className="text-gray-400 text-sm">Upcoming rocket launches from SpaceX, NASA, and more.</p>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
