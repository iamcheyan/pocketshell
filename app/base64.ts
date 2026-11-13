const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function decodeBase64(input: string): Uint8Array | null {
  if (!input || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) return null;
  const padding = input.endsWith("==") ? 2 : input.endsWith("=") ? 1 : 0;
  const output = new Uint8Array(input.length / 4 * 3 - padding);
  let offset = 0;
  for (let position = 0; position < input.length; position += 4) {
    const bits = (alphabet.indexOf(input[position]) << 18) | (alphabet.indexOf(input[position + 1]) << 12)
      | ((input[position + 2] === "=" ? 0 : alphabet.indexOf(input[position + 2])) << 6)
      | (input[position + 3] === "=" ? 0 : alphabet.indexOf(input[position + 3]));
    if (offset < output.length) output[offset++] = (bits >> 16) & 255;
    if (offset < output.length) output[offset++] = (bits >> 8) & 255;
    if (offset < output.length) output[offset++] = bits & 255;
  }
  return output;
}
