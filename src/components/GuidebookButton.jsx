import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { hasSeenGuidebook, startInteractiveGuidebook } from '../lib/guidebook';

export default function GuidebookButton({ activeTab = 'dashboard' }) {
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    setUnseen(!hasSeenGuidebook());
  }, [activeTab]);

  const handleStartTour = () => {
    startInteractiveGuidebook(activeTab, () => {
      setUnseen(false);
    });
  };

  return (
    <button
      type="button"
      data-tour="guidebook-trigger"
      onClick={handleStartTour}
      className="relative flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
      title="Mulai Panduan Tur Interaktif (Guidebook)"
    >
      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
      <span>Panduan</span>
      {unseen && (
        <span
          className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
          aria-label="Panduan belum dibuka"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 border border-white" />
        </span>
      )}
    </button>
  );
}
