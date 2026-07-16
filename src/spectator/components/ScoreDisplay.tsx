import React from 'react';
import { MatchScore, Side } from '../../types/score';

interface ScoreDisplayProps {
  total: number;
  score: MatchScore;
  side: Side;
  has_zenshu: boolean;
}

export default function ScoreDisplay({ total, score, side, has_zenshu }: ScoreDisplayProps) {
  const ippon = side === 'blue' ? score.blue_ippon : score.red_ippon;
  const waza = side === 'blue' ? score.blue_waza_ari : score.red_waza_ari;
  const yuko = side === 'blue' ? score.blue_yuko : score.red_yuko;

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      {/* Score inside a circle. When this side holds Senshu the ring lights up
          and a "SENSHU" badge sits on the circle. */}
      <div className="relative flex items-center justify-center">
        <div
          className={`flex items-center justify-center rounded-full transition-all
            w-[22rem] h-[22rem] max-w-[80%] aspect-square
            ${has_zenshu
              ? 'border-[10px] border-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.55)] bg-white/5'
              : 'border-[6px] border-white/20 bg-white/5'}`}
        >
          <div className="text-[11rem] font-score font-bold text-white leading-none drop-shadow-2xl">
            {total}
          </div>
        </div>

        {has_zenshu && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full
                          bg-yellow-400 text-gray-900 text-lg font-bold uppercase tracking-widest
                          shadow-lg whitespace-nowrap">
            Senshu
          </div>
        )}
      </div>

      <div className="flex gap-6 mt-10 text-white/70">
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
