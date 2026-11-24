import { Fragment } from "react";
import { descriptionBlocks } from "../lib/descriptionBlocks";
import "./RichDescription.css";

// La descripción de una propiedad con párrafos y listas (lib/descriptionBlocks.js). Solo texto: React lo escapa.
export default function RichDescription({ text, className = "" }) {
  const blocks = descriptionBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <div className={`rich-description ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "ul") return <ul key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</ul>;
        if (block.type === "ol") return <ol key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</ol>;
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
