import React from 'react';

interface FixedDigitsProps {
  text: string;
  /** Cell width for a digit, in em. */
  digit_em?: number;
  /** Cell width for ":" and ".", in em. */
  separator_em?: number;
}

/**
 * Renders a clock string with every glyph in a fixed-width cell.
 *
 * Oswald has proportional figures — a "1" is far narrower than a "4" — and no
 * tabular figure set for `font-variant-numeric` to switch to, so a freely-set
 * countdown visibly shakes as the digits roll. Giving each glyph the same
 * advance holds the clock steady, with separators on a narrower cell so the
 * grouping still reads.
 */
export default function FixedDigits({
  text, digit_em = 0.62, separator_em = 0.30,
}: FixedDigitsProps) {
  return (
    <>
      {text.split('').map((ch, i) => {
        const is_separator = ch === ':' || ch === '.';
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: `${is_separator ? separator_em : digit_em}em`,
              textAlign: 'center',
            }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
}
