// The arcade's game list. In the trial the five "fresh" games were written by Claude
// up front to stand in for generated ones; in the full version this comes from the
// generate pipeline and votes come from a shared store instead of this browser.
window.AISLOP_GAMES = [
  {
    id: "flow-resonance",
    title: "Flow // Resonance",
    blurb: "Tap to a rhythm. The music bends to meet you, then holds. Swipe or press Down to dive.",
    path: "games/flow-resonance.html",
    status: "house",
    hue: 168
  },
  {
    id: "orbit-hop",
    title: "Orbit Hop",
    blurb: "Fling yourself off one star's orbit and let the next one catch you.",
    prompt: "A one-button space game where you orbit stars and launch between them.",
    path: "games/orbit-hop.html",
    status: "fresh",
    hue: 45
  },
  {
    id: "lantern-drift",
    title: "Lantern Drift",
    blurb: "Steer a rising paper lantern through the canopy before the flame dies.",
    prompt: "A calm vertical game: a lantern floating up through branches, keep the flame lit.",
    path: "games/lantern-drift.html",
    status: "fresh",
    hue: 18
  },
  {
    id: "pulse-garden",
    title: "Pulse Garden",
    blurb: "Seeds sprout on the beat. Tap each one as its ring closes to make it bloom.",
    prompt: "A rhythm game in a garden where tapping in time makes flowers bloom.",
    path: "games/pulse-garden.html",
    status: "fresh",
    hue: 140
  },
  {
    id: "two-tone",
    title: "Two Tone",
    blurb: "Catch your colour, dodge the other, and flip when the rain changes.",
    prompt: "Catch falling drops but only the ones matching your colour; you can switch colours.",
    path: "games/two-tone.html",
    status: "fresh",
    hue: 320
  },
  {
    id: "ripple-pond",
    title: "Ripple Pond",
    blurb: "Tap the water to ripple drifting leaves onto the lily before they slip away.",
    prompt: "A relaxing physics game where you push floating leaves with ripples.",
    path: "games/ripple-pond.html",
    status: "fresh",
    hue: 185
  },
  {
    // First game from the live sandbox loop: one random roll plus one player fix
    id: "fold-and-float",
    title: "Fold & Float",
    blurb: "Tap on the beat to lift a paper plane over a dusk town; hold to slow time. Night falls as you climb.",
    prompt: "Random roll: a paper plane, rhythm taps on a beat, where time slows while you hold; cosy and warm. Fix: “Let the sky slowly turn to starry night as my score climbs”",
    path: "games/fold-and-float.html",
    status: "fresh",
    hue: 28
  }
];
