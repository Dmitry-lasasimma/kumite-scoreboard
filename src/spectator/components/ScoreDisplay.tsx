import React from 'react';
import { MatchScore, Side } from '../../types/score';

interface ScoreDisplayProps {
  total: number;
  score: MatchScore;
  side: Side;
}

export default function ScoreDisplay({ total, score, side }: ScoreDisplayProps) {
  const ippon = side === 'blue' ? score.blue_ippon : score.red_ippon;
  const waza = side === 'blue' ? score.blue_waza_ari : score.red_waza_ari;
  const yuko = side === 'blue' ? score.blue_yuko : score.red_yuko;

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-[10rem] font-score font-bold text-white leading-none drop-shadow-2xl">
        {total}
      </div>
      <div className="flex gap-6 mt-4 text-white/70">
        <div className="text-center">
          <div className="text-2xl font-score font-bold text-white">{ippon}</div>
          <div className="text-xs uppercase tracking-widest">Ippon</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-score font-bold text-white">{waza}</div>
          <div className="text-xs uppercase tracking-widest">Waza-ari</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-score font-bold text-white">{yuko}</div>
          <div className="text-xs uppercase tracking-widest">Yuko</div>
        </div>
      </div>
    </div>
  );
}
