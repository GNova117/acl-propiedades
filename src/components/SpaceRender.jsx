import "./SpaceRender.css";

const MAX_PX = 96;

function scaleDims(length, width, height) {
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const max = Math.max(l, w, h);
  if (!max) return null;
  const scale = MAX_PX / max;
  return { l: l * scale, w: w * scale, h: h * scale };
}

export default function SpaceRender({ length, width, height }) {
  const dims = scaleDims(length, width, height);

  if (!dims) {
    return <div className="space-render space-render--empty" />;
  }

  const vars = {
    "--l": `${dims.l}px`,
    "--w": `${dims.w}px`,
    "--h": `${dims.h}px`,
  };

  return (
    <div className="space-render">
      <div className="space-render__box" style={vars}>
        <div className="space-render__face space-render__face--top" />
        <div className="space-render__face space-render__face--front" />
        <div className="space-render__face space-render__face--side" />
      </div>
    </div>
  );
}
