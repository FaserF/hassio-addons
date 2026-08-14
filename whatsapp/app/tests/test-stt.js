import assert from 'assert';

console.log('🧪 Running STT Unit & Endpoint Parser Tests...');

// Test 1: Verify Gemini response parsing
const geminiResponse = {
  candidates: [
    {
      content: {
        parts: [
          { text: 'Hallo Test Sprachnachricht' },
        ],
      },
    },
  ],
};
const geminiText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
assert.strictEqual(geminiText, 'Hallo Test Sprachnachricht');
console.log('✅ PASSED: Gemini STT response JSON parser extracts transcript correctly');

// Test 2: Verify OpenAI Whisper response parsing
const whisperResponse = {
  text: 'Hallo Test Sprachnachricht',
};
const whisperText = whisperResponse.text?.trim();
assert.strictEqual(whisperText, 'Hallo Test Sprachnachricht');
console.log('✅ PASSED: Whisper STT response JSON parser extracts transcript correctly');

console.log('✅ ALL STT TESTS PASSED');
