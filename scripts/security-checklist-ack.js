const ACKNOWLEDGEMENT_REGEX = /\backnowledg\w*/i;

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
    if (!cleanedParagraph.includes('checklist') || !cleanedParagraph.includes('security')) {
      return false;
    }

    const sentences = paragraph
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => cleanWhitespace(sentence))
      .filter(Boolean);

    const sentenceMatch = sentences.some(
      (sentence) =>
        sentence.includes('checklist') &&
        sentence.includes('security') &&
        ACKNOWLEDGEMENT_REGEX.test(sentence)
    );

    if (sentenceMatch) {
      return true;
    }

    return ACKNOWLEDGEMENT_REGEX.test(cleanedParagraph);
  });
}

module.exports = {
  hasAcknowledgementPhrase,
};
