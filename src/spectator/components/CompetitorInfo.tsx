import React from 'react';
import { Side } from '../../types/score';

interface CompetitorInfoProps {
  name: string;
  club: string;
  side: Side;
}

export default function CompetitorInfo({ name, club, side }: CompetitorInfoProps) {
  return (
    <div className={`flex items-start ${side === 'red' ? 'justify-end' : ''}`}>
      <div className={side === 'red' ? 'text-right' : ''}>
        <div className="text-4xl font-score font-bold text-white tracking-wide">{name}</div>
        {club && <div className="text-sm text-white/60 mt-1">{club}</div>}
      </div>
    </div>
  );
}
