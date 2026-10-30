import { defineProfile } from "../../framework/src/profile.ts";

export default defineProfile({
  id: "rocknix-h700-kms",
  platform: "linux",
  form: "embedded",
  tickHz: 60,
  display: {
    physicalViewport: [720, 480],
    logicalViewports: [[360, 240]],
    rasterDensity: 2,
    presentations: ["native", "integer-fit"],
  },
  capabilities: ["input.buttons", "text.glyphs.baked"],
  roleCapabilities: {},
});
