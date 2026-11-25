import React from 'react';
import { BookOpen } from 'lucide-react';
import { startInteractiveGuidebook } from '../lib/guidebook';
import { Button } from './ui/button';

export default function GuidebookButton({ activeTab }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-tour="guidebook-trigger"
      onClick={() => startInteractiveGuidebook(activeTab)}
      title="Mulai Panduan Interaktif Halaman Ini"
      className="h-8 gap-1.5 text-xs"
    >
      <BookOpen className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">Panduan</span>
    </Button>
  );
}
