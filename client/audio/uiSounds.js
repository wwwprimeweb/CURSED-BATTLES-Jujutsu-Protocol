export function playHoverSound(audio) {
  audio.syntheticClick(0.03);
}

export function playClickSound(audio) {
  audio.syntheticClick(0.12);
}

export function playSelectSound(audio) {
  audio.syntheticChime(0.12, 800, 0.3);
}

export function playOpenSound(audio) {
  audio.syntheticWhoosh(0.1, true);
}

export function playCloseSound(audio) {
  audio.syntheticWhoosh(0.08, false);
}

export function playTabSwitchSound(audio) {
  audio.syntheticClick(0.07);
}

export function playSliderTickSound(audio) {
  audio.syntheticClick(0.02);
}

export function playProntoSound(audio) {
  audio.playBuffer("prontoSound", 0.7);
}

export function playCharacterHoverSound(audio) {
  audio.playBuffer("characterHoverSound", 1.0);
}

export function playSelectCharSound(audio) {
  audio.playBuffer("selectCharSound", 0.7);
}
