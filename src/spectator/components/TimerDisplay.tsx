import React from 'react';
import { format_time } from '../../utils/validators';

interface TimerDisplayProps {
  time_remaining: number;
  is_running: boolean;
}

export default function TimerDisplay({ time_remaining, is_running }: TimerDisplayProps) {
  const is_low = time_remaining <= 30 && time_remaining > 0;

  return (
    <div className={`text-center ${is_low ? 'animate-pulse' : ''}`}>
      <div className={`text-6xl font-score font-bold tracking-wider
        ${time_remaining <= 0 ? 'text-gray-600' : is_low ? 'text-kumite-red-400' : 'text-white'}`}>
        {format_time(time_remaining)}
      </div>
      <div className={`text-xs uppercase tracking-widest mt-2 font-semibold
        ${is_running ? 'text-green-400' : 'text-yellow-400'}`}>
        {is_running ? 'Fight' : 'Stopped'}
      </div>
    </div>
  );
}
