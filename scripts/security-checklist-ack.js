const ACKNOWLEDGEMENT_REGEX = /\backnowledg\w*/i;

function hasSecurityChecklistMention(text) {
  return text.includes('checklist') && text.includes('security');
}

function hasAcknowledgementAfterChecklist(text) {
  if (!hasSecurityChecklistMention(text)) {
    return false;
  }

  const acknowledgementSearch = new RegExp(ACKNOWLEDGEMENT_REGEX.source, 'gi');
  let match;

  while ((match = acknowledgementSearch.exec(text)) !== null) {
    const prefix = text.slice(0, match.index);
    if (hasSecurityChecklistMention(prefix)) {
      return true;
    }
  }

  return false;
}

function cleanWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function hasAcknowledgementPhrase(text) {
  const normalized = (text || '').toLowerCase();
  if (!normalized.trim()) {
    return false;
  }

  const paragraphs = splitParagraphs(normalized);
  const segments = paragraphs.length > 0 ? paragraphs : [normalized];

  return segments.some((paragraph) => {
    const cleanedParagraph = cleanWhitespace(paragraph);
    if (!hasSecurityChecklistMention(cleanedParagraph)) {
      return false;
    }

    const sentences = paragraph
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => cleanWhitespace(sentence))
      .filter(Boolean);

    const sentenceMatch = sentences.some(
      (sentence) => hasSecurityChecklistMention(sentence) && ACKNOWLEDGEMENT_REGEX.test(sentence),
    );

    if (sentenceMatch) {
      return true;
    }

    return hasAcknowledgementAfterChecklist(cleanedParagraph);
  });
}

module.exports = {
  hasAcknowledgementPhrase,
};
