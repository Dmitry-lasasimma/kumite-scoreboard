import React from 'react';
import { Side } from '../../types/score';

interface CompetitorInfoProps {
  name: string;
  club: string;
  side: Side;
}

export default function CompetitorInfo({ name, club, side }: CompetitorInfoProps) {
  const is_red = side === 'red';

  return (
    <div className={`flex items-start shrink-0 ${is_red ? 'justify-end' : ''}`}>
      <div className={`min-w-0 ${is_red ? 'text-right' : ''}`}>
        <div className={`font-bold uppercase tracking-[0.4em] text-white/50 mb-[0.3vh]`}
             style={{ fontSize: 'min(1.8vh, 1.4vw)' }}>
          {is_red ? 'Aka' : 'Ao'}
        </div>
        <div className="font-score font-bold text-white tracking-wide truncate"
             style={{ fontSize: 'min(4.4vh, 3.2vw)' }}>
          {name}
        </div>
        {club && (
          <div className="text-white/60 truncate mt-[0.2vh]"
               style={{ fontSize: 'min(2vh, 1.5vw)' }}>
            {club}
          </div>
        )}
      </div>
    </div>
  );
}
