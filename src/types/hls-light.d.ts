// hls.js ships `hls.js/light` (no subtitles, EME or alternate audio) without its own types entry;
// it exposes the same API as the full build.
declare module "hls.js/light" {
  export * from "hls.js";
  export { default } from "hls.js";
}
