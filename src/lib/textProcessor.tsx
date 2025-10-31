import React from "react";
import { Link } from "react-router-dom";
import { buildMentionRegex, extractMentions, getProfileUrl } from "./mentionHelpers";

export function linkifyMentionsToNodes(content: string, allUserNames: string[]): React.ReactNode[] {
  if (!content) return [content];
  if (!allUserNames.length) return [content];
  const re = buildMentionRegex(allUserNames);
  if (!re) return [content];

  const mentions = extractMentions(content, allUserNames);
  if (!mentions.length) return [content];

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  mentions.forEach((m, idx) => {
    if (m.index > cursor) parts.push(content.slice(cursor, m.index));
    const matchText = content.slice(m.index, m.index + m.length);
    parts.push(
      <Link key={`${m.index}-${m.length}-${idx}`} to={getProfileUrl(m.name)} className="text-primary hover:underline font-semibold">
        {matchText}
      </Link>
    );
    cursor = m.index + m.length;
  });

  if (cursor < content.length) parts.push(content.slice(cursor));
  return parts;
}

export function highlightMentionsAsText(content: string, allUserNames: string[], tagOpen = "[[", tagClose = "]]"): string {
  if (!content || !allUserNames.length) return content;
  const mentions = extractMentions(content, allUserNames);
  if (!mentions.length) return content;

  let out = "";
  let cursor = 0;

  for (const m of mentions) {
    out += content.slice(cursor, m.index);
    out += `${tagOpen}${content.slice(m.index, m.index + m.length)}${tagClose}`;
    cursor = m.index + m.length;
  }
  if (cursor < content.length) out += content.slice(cursor);
  return out;
}
