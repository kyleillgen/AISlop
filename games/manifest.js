// The arcade's game list. In the trial the five "fresh" games were written by Claude
// up front to stand in for generated ones; in the full version this comes from the
// generate pipeline and votes come from a shared store instead of this browser.
window.AISLOP_GAMES = [
  {
    id: "flow-resonance",
    title: "Flow // Resonance",
    blurb: "The original by Gemini. Tap to a rhythm: the engine finds your cadence, locks into your sweet spot, and every tap plays in key.",
    path: "games/flow-resonance.html",
    status: "house",
    hue: 168
  },
  {
    id: "orbit",
    title: "Orbit",
    blurb: "Fling a steel ball from bumper to bumper up an endless table. Let go as it crosses the arrow and the next bumper catches it.",
    path: "games/orbit.html",
    status: "house",
    hue: 30
  },
  {
    id: "flipper",
    title: "Flipper",
    blurb: "One button, both flippers. Flip as the ball comes down to knock out the drop targets; hold to cradle it and let go for the orbit shot.",
    path: "games/flipper.html",
    status: "house",
    hue: 350
  },
  {
    id: "ricochet",
    title: "Ricochet",
    blurb: "A steel ball climbs a shaft between two rubber walls. Kick as it reaches a wall and it springs across, higher every time. Hold to grip, let go for a super jump.",
    path: "games/ricochet.html",
    status: "house",
    hue: 120
  },
  {
    // First game on the shared flow engine (games/flow-engine.js)
    id: "word-rain",
    title: "Word Rain",
    blurb: "Type the falling words before they reach the river. The music settles into your typing rhythm and every letter is a note.",
    path: "games/word-rain.html",
    status: "house",
    hue: 200
  },
  // Flow Toys: hand-made fidgets with no score and no losing, for keeping beside your editor
  {
    id: "resonance-glide",
    title: "Resonance Glide",
    blurb: "Flow's flight with nothing to crash into. Ride a harmonic ribbon through aurora skies; leave it and it glides itself.",
    path: "games/resonance-glide.html",
    status: "toy",
    hue: 175
  },
  {
    id: "orbit-loom",
    title: "Orbit Loom",
    blurb: "Weave notes onto six rings while a hand sweeps round and plays them. Always in key; left alone, it re-weaves itself.",
    path: "games/orbit-loom.html",
    status: "toy",
    hue: 275
  },
  {
    id: "string-doodle",
    title: "String Doodle",
    blurb: "Drag to stretch glowing strings, then brush across them to pluck. Short ones chime, long ones hum, all in key.",
    path: "games/string-doodle.html",
    status: "toy",
    hue: 265
  },
  {
    id: "pop-field",
    title: "Pop Field",
    blurb: "An endless drift of soft bubbles. Tap or swipe through them; every pop is a note from the chord.",
    path: "games/pop-field.html",
    status: "toy",
    hue: 195
  },
  {
    id: "zen-ripple-pond",
    title: "Zen Ripple Pond",
    blurb: "Ripple leaves onto the lily at your own pace. Nothing drifts away for good, and rain keeps it moving when you don't.",
    path: "games/zen-ripple-pond.html",
    status: "toy",
    hue: 170
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
  },
  // Batch 2: five live random rolls, each built on the shared Flow layer
  {
    id: "lantern-lob",
    title: "Lantern Lob",
    blurb: "Drag back and fling a little lantern fish from jelly to jelly; every catch shifts the tune.",
    prompt: "Random roll: a lantern fish, aiming and launching, where collecting things changes the music; neon at night",
    path: "games/lantern-lob.html",
    status: "fresh",
    hue: 200
  },
  {
    id: "topsy-turtle",
    title: "Topsy Turtle",
    blurb: "Keep a beach ball bouncing off your shell while gravity flips and you swim to the other side.",
    prompt: "Random roll: a sea turtle, keeping something balanced, where gravity slowly flips back and forth; bright and bouncy",
    path: "games/topsy-turtle.html",
    status: "fresh",
    hue: 250
  },
  {
    id: "glimmerwing",
    title: "Glimmerwing",
    blurb: "Keep moving to stay bright; gather the sugarlings and lead them home to the blossom.",
    prompt: "Random roll: a hummingbird, gathering things into a group, where the light around you shrinks unless you keep moving; candy-coloured",
    path: "games/glimmerwing.html",
    status: "fresh",
    hue: 290
  },
  {
    id: "snugcap",
    title: "Snugcap",
    blurb: "Hold to swell your mushroom cap, let go to shrink, and squeeze through gaps as snugly as you dare.",
    prompt: "Random roll: a glowing mushroom, matching a shape or gap, where points come from near misses; eerie but cute",
    path: "games/snugcap.html",
    status: "fresh",
    hue: 180
  },
  {
    id: "dripbeat",
    title: "Dripbeat",
    blurb: "Tap as each halo meets the raindrop. Stay on beat and the whole aurora sky speeds up.",
    prompt: "Random roll: a raindrop, rhythm taps on a beat, where everything speeds up only while you're doing well; aurora sky",
    path: "games/dripbeat.html",
    status: "fresh",
    hue: 160
  },
  // Batch 3: three live toy rolls; kept toys shelve under Flow Toys
  {
    id: "sunset-lyre",
    title: "Sunset Lyre",
    blurb: "The setting sun's rays are strings. Tap or strum across them and the sky answers in key.",
    prompt: "Random toy roll: plucked strings, played by tapping, where it settles into patterns; sunset pop",
    path: "games/sunset-lyre.html",
    status: "fresh",
    lane: "toy",
    hue: 330
  },
  {
    id: "ember-harp",
    title: "Ember Harp",
    blurb: "A warm harp of glowing strings. Tap or drag across them and embers flicker off each note.",
    prompt: "Random toy roll: plucked strings, played by tapping, where it swirls and calms down; cosy and warm",
    path: "games/ember-harp.html",
    status: "fresh",
    lane: "toy",
    hue: 30
  },
  {
    id: "breathing-glowsand",
    title: "Breathing Glowsand",
    blurb: "A tray of glowing sand. Press and hold to breathe in a hollow; let go and it breathes back out.",
    prompt: "Random toy roll: kinetic sand, played by pressing and releasing, where it breathes in and out; neon at night",
    path: "games/breathing-glowsand.html",
    status: "fresh",
    lane: "toy",
    hue: 255
  }
];
