// src/components/ContentRenderer.tsx
import { Link } from "react-router-dom";
import React from "react";

interface ContentRendererProps {
  content: string;
  className?: string;
}

const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9\-]+)\)/g;

export const ContentRenderer = ({ content, className }: ContentRendererProps) => {
  if (!content) return null;

  const parts = content.split(mentionRegex);
  const elements = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) {
        elements.push(<React.Fragment key={i}>{parts[i]}</React.Fragment>);
      }
    } else if (i % 3 === 1) {
      const name = parts[i];
      const id = parts[i + 1];
      
      elements.push(
        <Link
          key={i}
          to={`/profile/${id}`}
          className="text-primary font-semibold"
          onClick={(e) => e.stopPropagation()}
        >
          @{name}
        </Link>
      );
      i++;
    }
  }

  return (
    <p className={className}>
      {elements}
    </p>
  );
};