const { hasAcknowledgementPhrase } = require('../scripts/security-checklist-ack');

const testCases = [
  {
    description: 'acknowledgement precedes security mention',
    text: 'Acknowledged the security checklist as requested.',
    expected: true,
  },
  {
    description: 'security mention precedes acknowledgement',
    text: 'Checklist for security has been acknowledged.',
    expected: true,
  },
  {
    description: 'paragraph match when bot uses colon formatting',
    text: 'Security checklist: acknowledged.',
    expected: true,
  },
  {
    description: 'reject text missing acknowledgement verb',
    text: 'Security checklist reviewed by automation.',
    expected: false,
  },
  {
    description: 'reject acknowledgement without security reference',
    text: 'The checklist has been acknowledged.',
    expected: false,
  },
  {
    description: 'reject acknowledgement where checklist and security are in separate paragraphs',
    text: 'Security updates are in progress.\n\nThe checklist has been acknowledged.',
    expected: false,
  },
];

let failures = 0;

testCases.forEach(({ description, text, expected }, index) => {
  const actual = hasAcknowledgementPhrase(text);
  const passed = actual === expected;
  if (!passed) {
    failures += 1;
    console.error(
      `Test ${index + 1} failed (${description}). Expected ${expected} but received ${actual}.`,
    );
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}

console.log(`All ${testCases.length} security acknowledgement tests passed.`);
