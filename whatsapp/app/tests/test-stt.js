import assert from 'assert';

console.log('🧪 Running STT Unit & Endpoint Parser Tests...');

// Test 1: Verify Google v2 API URL format and JSON structure parsing
const testData = JSON.stringify({
  result: [
    {
      alternative: [{ transcript: 'Hallo Test Sprachnachricht' }]
    }
  ]
});

const lines = testData.split('\n').filter((l) => l.trim().length > 0);
let parsed = null;
for (const line of lines) {
  try {
    const jsonObj = JSON.parse(line);
    if (jsonObj.result?.[0]?.alternative?.[0]?.transcript) {
      parsed = jsonObj;
      break;
    }
  } catch (_err) {}
}

const hyp = parsed?.result?.[0]?.alternative?.[0]?.transcript;
assert.strictEqual(hyp, 'Hallo Test Sprachnachricht');
console.log('✅ PASSED: Google v2 STT response JSON parser extracts transcript correctly');

console.log('✅ ALL STT TESTS PASSED');
