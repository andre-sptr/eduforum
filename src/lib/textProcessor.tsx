import React from 'react';
import { Link } from 'react-router-dom';

export const processCommentContent = (content: string, allUserNames: string[]) => {
  if (!content || allUserNames.length === 0) return [content];
  const escapedNames = allUserNames
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) 
    .join('|');
  const DYNAMIC_MENTION_REGEX = new RegExp(`@(${escapedNames})`, 'g');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  content.replace(DYNAMIC_MENTION_REGEX, (match, username, index) => {
    if (index > lastIndex) {
      parts.push(content.substring(lastIndex, index));
    }
    const profileUrl = `/profile/name/${encodeURIComponent(username)}`;
    parts.push(
      <Link 
        key={index} 
        to={profileUrl} 
        className="text-blue-500 hover:underline font-semibold"
      >
        {match}
      </Link>
    );
    lastIndex = index + match.length;
    return match;
  });
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }
  return parts;
};