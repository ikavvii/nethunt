import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { MapPin, Sparkles, Key, CheckCircle, Gift, Award, Compass } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CampusLore() {
  const { user, token, refreshUser } = useAuth();
  const { playEasterEggSound } = useAudio();
  const [eggInput, setEggInput] = useState('');
  const [unlockedEggs, setUnlockedEggs] = useState([]);
  const [redeemStatus, setRedeemStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMyEggs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/hunt/my-easter-eggs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUnlockedEggs(data.eggs || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchMyEggs();
  }, [token]);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!eggInput.trim() || loading || !token) return;

    setLoading(true);
    setRedeemStatus(null);

    try {
      const res = await fetch('/api/hunt/easter-egg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ eggCode: eggInput })
      });

      const data = await res.json();
      if (res.ok) {
        playEasterEggSound();
        confetti({
          particleCount: 70,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#38bdf8', '#fbbf24', '#34d399']
        });
        setRedeemStatus({ type: 'success', message: data.message });
        setEggInput('');
        await refreshUser();
        await fetchMyEggs();
      } else {
        setRedeemStatus({ type: 'error', message: data.error });
      }
    } catch (e) {
      setRedeemStatus({ type: 'error', message: 'Failed to redeem code.' });
    } finally {
      setLoading(false);
    }
  };

  const campusSpots = [
    {
      title: "F-Block & The Third Floor UNIX Lab",
      tag: "Academic Sanctum",
      image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
      description: "Home of the Department of Computer Applications. Endless hours debugging segmentation faults, writing shell scripts, and organizing LOGIN committees.",
      hintSecret: "Secret Clue: Check the index.html source code for a rooftop breeze!"
    },
    {
      title: "The Quadrangle",
      tag: "Cultural Heart",
      image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80",
      description: "The historic open-air courtyard surrounded by iconic red-brick architecture. Venue of flash mobs, symposium teasers, and batch photos.",
      hintSecret: "Whispers of alumni reverberate from the stairs."
    },
    {
      title: "PSG Tech Canteen",
      tag: "Campus Fuel",
      image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
      description: "The 10:45 AM interval sprint! Hot filter coffee, mint chutney, and legendary triangular samosas that powered generations of programmers.",
      hintSecret: "Code: CANTEEN_SAMOSA"
    },
    {
      title: "Dr. G.R. Damodaran Auditorium",
      tag: "Grand Assembly",
      image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80",
      description: "With its stellar acoustics and royal wooden panels, the GRD auditorium hosted LOGIN inaugurations, cultural nights, and industry keynotes.",
      hintSecret: "Named after visionary Dr. GRD."
    },
    {
      title: "The Skywalk over Avinashi Road",
      tag: "Iconic Pathway",
      image: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=600&q=80",
      description: "Soaring above the Coimbatore-Avinashi highway, linking the hostels and sports grounds to the college campus. A lifeline for 8:30 AM classes.",
      hintSecret: "Elevated connection of Peelamedu."
    },
    {
      title: "Peelamedu Night Walks",
      tag: "Coimbatore Vibes",
      image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80",
      description: "Cool Coimbatore night breeze, midnight tea stalls outside the college gate, discussions on placement drives and upcoming startup ideas.",
      hintSecret: "Code: PEELAMEDU_NIGHT_TEA"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center space-x-1.5 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold text-amber-300">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>CAMPUS HERITAGE & SECRETS</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">
          PSG Tech Campus Lore
        </h1>
        <p className="text-slate-300 text-sm">
          Relive the nostalgic corners of our Peelamedu campus. Hidden throughout the platform and source code are secret easter egg codes that reward bonus points!
        </p>
      </div>

      {/* Secret Easter Egg Redemption Box */}
      <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 max-w-xl mx-auto shadow-2xl space-y-4">
        <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
          <Gift className="w-4 h-4 text-amber-400" />
          <span>Redeem Campus Easter Egg Code</span>
        </div>

        <form onSubmit={handleRedeem} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={eggInput}
              onChange={(e) => setEggInput(e.target.value)}
              placeholder="e.g. CANTEEN_SAMOSA..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !eggInput.trim() || !token}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs font-mono shadow-md disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Claim Points'}
          </button>
        </form>

        {redeemStatus && (
          <p className={`text-xs font-medium ${redeemStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {redeemStatus.message}
          </p>
        )}

        {/* Unlocked Badges */}
        {unlockedEggs.length > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-mono uppercase text-slate-400">Your Discovered Campus Badges:</span>
            <div className="flex flex-wrap gap-2">
              {unlockedEggs.map(egg => (
                <span key={egg.egg_code} className="bg-amber-400/10 border border-amber-400/40 text-amber-300 text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1.5 font-medium">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>{egg.title} (+{egg.points} pts)</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Campus Spots Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campusSpots.map((spot, i) => (
          <div key={i} className="glass-panel rounded-2xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between group">
            <div>
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={spot.image} 
                  alt={spot.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90"
                />
                <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-cyan-300 border border-cyan-700/50 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                  {spot.tag}
                </span>
              </div>

              <div className="p-5 space-y-2">
                <h3 className="font-bold text-white text-base leading-snug group-hover:text-amber-400 transition-colors">
                  {spot.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {spot.description}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 text-[11px] font-mono text-amber-400/90 flex items-center justify-between">
              <span className="truncate">{spot.hintSecret}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
