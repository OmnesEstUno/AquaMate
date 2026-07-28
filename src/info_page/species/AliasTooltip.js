import React, { useState, useCallback, useRef } from 'react';

export function AliasTooltip({ label, aliases }) {
  const [pos, setPos] = useState(null);
  const tipRef = useRef(null);

  const onMove = useCallback((e) => {
    const tip = tipRef.current;
    const w = tip ? tip.offsetWidth : 240;
    const h = tip ? tip.offsetHeight : 80;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > window.innerWidth) x = e.clientX - w - 16;
    if (y + h > window.innerHeight) y = e.clientY - h - 16;
    setPos({ x, y });
  }, []);

  const show = (e) => { onMove(e); };
  const hide = () => setPos(null);

  return (
    <>
      <span className="species-alias-trigger" onMouseEnter={show} onMouseMove={onMove} onMouseLeave={hide}>
        {label}
      </span>
      {pos && aliases.length > 0 && (
        <span ref={tipRef} className="species-alias-tip" role="tooltip" style={{ left: pos.x, top: pos.y }}>
          <span className="species-alias-tip__h">Also known as ({aliases.length})</span>
          {aliases.map((a) => <span key={a} className="species-alias-tip__n">{a}</span>)}
        </span>
      )}
    </>
  );
}
