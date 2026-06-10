import React from 'react';
import { Side } from '../../types/score';

interface CompetitorInfoProps {
  name: string;
  club: string;
  side: Side;
  has_zenshu: boolean;
}

export default function CompetitorInfo({ name, club, side, has_zenshu }: CompetitorInfoProps) {
  return (
    <div className={`flex items-start justify-between ${side === 'red' ? 'flex-row-reverse' : ''}`}>
      <div className={side === 'red' ? 'text-right' : ''}>
        <div className="text-4xl font-score font-bold text-white tracking-wide">{name}</div>
        {club && <div className="text-sm text-white/60 mt-1">{club}</div>}
      </div>
      {has_zenshu && (
        <div className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-bold uppercase tracking-wider border border-white/30">
          Senshu
        </div>
      )}
    </div>
  );
}
