// Draws a banner heading made of text pieces (see config/heading.js): "\n" becomes a line break and a
// piece with a colour is wrapped in a coloured span. Text only, never HTML, so a heading can't inject markup.
import { Fragment } from 'react';

export function HeadingPieces({ segments }) {
  const out = [];
  (segments || []).forEach((s, i) => {
    String(s.text || '')
      .split('\n')
      .forEach((part, j) => {
        if (j > 0) out.push(<br key={`b${i}.${j}`} />);
        if (part) out.push(s.color ? <span key={`t${i}.${j}`} style={{ color: s.color }}>{part}</span> : <Fragment key={`t${i}.${j}`}>{part}</Fragment>);
      });
  });
  return out;
}
