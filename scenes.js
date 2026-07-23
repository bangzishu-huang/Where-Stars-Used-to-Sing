
const SCENES = [

  // STAGE 1
  {
    id: "stage1",
    label: "Stage 1",
    title: "THE SILENCE",
    bg: "#3a3a3a",         
    saturate: 0,             
    onEnterDialogue: [
      "The city is quiet. Efficient. Nobody looks up.",
      "You've been hired to investigate \u201CThe Forgotten Event.\u201D",
      "Nobody remembers what it was. Only that something disappeared.",
      "Not someone. Something."
    ],
    hotspots: [
      {
        id: "crayon",
        x: 22, y: 68, w: 60, h: 60,
        dialogue: [
          "A broken crayon, half-buried near the bulletin board.",
          "You pick it up. Not sure why it matters yet."
        ],
        giveItem: "crayon",
        oneTimeDialogue: true
      },
      {
        id: "drawing",
        x: 65, y: 55, w: 70, h: 70,
        requiresItems: ["crayon"],
        lockedDialogue: [
          "A child's drawing, pinned to the board. Part of it is smudged \u2014 unreadable.",
          "Something's missing here."
        ],
        dialogue: [
          "You fill in the smudged part with the crayon.",
          "It says: \u201CThe stars used to sing.\u201D",
          "Ridiculous. You almost laugh.",
          "You touch the drawing anyway."
        ],
        isClue: true
      }
    ]
  },

  // STAGE 2 — WHEN PEOPLE LOOKED UP
  {
    id: "stage2",
    label: "Stage 2 \u2014 5 years earlier",
    title: "WHEN PEOPLE LOOKED UP",
    bg: "#5b6b4f",
    saturate: 40,
    onEnterDialogue: [
      "Color. Not vibrant \u2014 just alive.",
      "Birds. Street musicians. Someone waves at you.",
      "Nobody comments on any of it. This is just normal, here."
    ],
    hotspots: [
      {
        id: "grandmother",
        x: 30, y: 60, w: 60, h: 60,
        dialogue: [
          "An old woman feeds pigeons on a bench.",
          "\u201CLovely morning,\u201D she says, not looking up.",
          "You glance toward the sky. She's right."
        ],
        giveFlag: "talked_to_grandmother",
        oneTimeDialogue: true
      },
      {
        id: "photo",
        x: 75, y: 40, w: 50, h: 50,
        dialogue: [
          "Your apartment window. Inside, a family photo on the sill.",
          "Someone is missing from it. You're sure it wasn't always like that.",
          "..."
        ],
        oneTimeDialogue: true
      },
      {
        id: "bird",
        x: 50, y: 30, w: 55, h: 55,
        requiresFlags: ["talked_to_grandmother"],
        lockedDialogue: [
          "A bird circles overhead, carrying something. It won't land near you yet."
        ],
        dialogue: [
          "The bird finally lands and drops a folded paper.",
          "It reads: \u201CYou're closer.\u201D",
          "That's impossible. You touch it anyway."
        ],
        isClue: true
      }
    ]
  },

  // STAGE 3 
  {
    id: "stage3",
    label: "Stage 3 \u2014 30 years earlier",
    title: "WHEN THE WORLD STILL SANG",
    bg: "#2e4d6b",
    saturate: 85,
    onEnterDialogue: [
      "Fireflies drift like slow constellations.",
      "The ocean glows faintly in the distance.",
      "Rain hangs in the air for a second before it falls.",
      "This is the most beautiful thing you've ever seen. Nobody else seems to notice."
    ],
    hotspots: [
      {
        id: "sign",
        x: 20, y: 45, w: 55, h: 55,
        dialogue: [
          "A weathered sign, facing the wrong way. It reads: \u201CTurn left.\u201D",
          "There's nothing to the left but trees."
        ],
        giveFlag: "clue_turnleft",
        oneTimeDialogue: true
      },
      {
        id: "fireflies",
        x: 50, y: 65, w: 55, h: 55,
        dialogue: [
          "A cluster of fireflies pulses in rhythm, almost like they're waiting.",
          "A small note is tucked in the grass beneath them: \u201CWait ten seconds.\u201D"
        ],
        giveFlag: "clue_wait",
        oneTimeDialogue: true
      },
      {
        id: "childfigure",
        x: 78, y: 50, w: 55, h: 55,
        dialogue: [
          "A silhouette of a child, gone before you reach it.",
          "Carved into the ground where they stood: \u201CTrust the child.\u201D"
        ],
        giveFlag: "clue_trust",
        oneTimeDialogue: true
      },
      {
        id: "tree",
        x: 48, y: 25, w: 90, h: 110,
        requiresFlags: ["clue_turnleft", "clue_wait", "clue_trust"],
        lockedDialogue: [
          "An enormous tree, roots older than the city ever was.",
          "You're not ready to approach it yet. Something is still missing."
        ],
        dialogue: [
          "Turn left. Wait ten seconds. Trust the child.",
          "You follow all three, exactly as instructed.",
          "The tree's bark splits open into a doorway of light."
        ],
        isClue: true
      }
    ]
  },

  // STAGE 4 — BEFORE WE FORGOT (ending stage)
  {
    id: "stage4",
    label: "Stage 4",
    title: "BEFORE WE FORGOT",
    bg: "#0d0d1a",
    saturate: 100,
    onEnterDialogue: [
      "No city. No civilization. Only stars, silence, and one enormous tree.",
      "A child sits beneath it, drawing. Listening."
    ],
    hotspots: [
      {
        id: "child",
        x: 50, y: 60, w: 70, h: 70,
        dialogue: [
          "\u201CYou finally made it,\u201D the child says.",
          "\u201CI've been waiting.\u201D",
          "\u201CYou know me?\u201D you ask.",
          "\u201CNo. But I knew you'd come.\u201D",
          "The child hands you an empty notebook.",
          "\u201CI couldn't write it. You have to.\u201D",
          "You sit. You open the notebook. Your hand begins to move on its own.",
          "The child's drawing. The bird's note. The sign. The fireflies. The silhouette.",
          "Every clue \u2014 written in your own handwriting.",
          "You didn't solve the mystery. You created it.",
          "The child speaks again. \u201CDo you hear them?\u201D",
          "You look up. A choir, faint and impossible, drifts from the stars.",
          "\u201CThey've always sung,\u201D the child says. \u201CThey never stopped. You just forgot.\u201D",
          "You try to remember your apartment. Nothing.",
          "Your mother's face. Nothing.",
          "Your own name. Nothing.",
          "\u201CEvery answer asks for something in return,\u201D the child says quietly.",
          "A pause.",
          "\u201CYou chose to remember the world... instead of yourself.\u201D"
        ],
        triggerChoiceAfter: true,
        oneTimeDialogue: true
      }
    ]
  }

];

// ENDING TEXT — shown after the final Remember / Forget choice
const ENDINGS = {
  remember: [
    "The child nods, sadly. \u201CYou'll forget this place. You'll stop hearing them.\u201D",
    "Fade to gray. You're back where you started \u2014 the city, the noise, the schedules.",
    "You begin to walk away, just like everyone else.",
    "A little girl stops. Looks up at the sky. Smiles.",
    "\u201CCan you hear them too?\u201D she asks.",
    "For one second, you pause. A single faint musical note.",
    "You look up, just a little longer than you normally would."
  ],
  forget: [
    "\u201CI don't need them,\u201D you say.",
    "The protagonist smiles. The notebook closes.",
    "The world pulls away \u2014 years pass, then centuries. Cities rise and fall.",
    "Eventually, a younger investigator arrives at the beginning of it all.",
    "They find a notebook, left beneath a tree.",
    "The loop continues."
  ]
};
