import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonLd } from "./jsonLd";

test("serializeJsonLd prevents script breakout while preserving data", () => {
  const value = {
    name: "</script><script>globalThis.pwned = true</script>",
    description: "Line separator:\u2028 paragraph separator:\u2029 & markup <b>unsafe</b>",
  };

  const serialized = serializeJsonLd(value);

  assert.doesNotMatch(serialized, /<\/script/i);
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.deepEqual(JSON.parse(serialized), value);
});