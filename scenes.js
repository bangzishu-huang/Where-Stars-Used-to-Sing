const SCENES = [

  {
    id: "stage1",
    label: "Stage 1",
    title: "THE SILENCE",
    map: "stage1",
    objective: "Talk to the witnesses marked with !",
    objectiveCar: "Find the car with the child's drawing.",
    onEnterDialogue: [
      "~The city is quiet. Efficient. Nobody looks up.~",
      "~You've been hired to investigate \u201CThe Forgotten Event.\u201D~",
      "~Nobody remembers what it was. Only that something disappeared.~",
      "~Not someone. Something.~",
      "~Someone around here must remember something. Talk to people.~"
    ],

    interviews: [
      {
        id: "witness1",
        dialogue: [
          "People keep asking me about it... I wish I could remember."
        ]
      },
      {
        id: "witness2",
        dialogue: [
          "My grandmother used to tell stories about this place.",
          "She talked about a drawing a child left on a car window.",
          "I never knew what it meant."
        ]
      },
      {
        id: "witness3",
        dialogue: [
          "There used to be... something here.",
          "No one knows what."
        ]
      }
    ],

    parkingCars: [
      { mapX: 608, mapY: 375, mapW: 32, mapH: 20 },
      { mapX: 607, mapY: 342, mapW: 32, mapH: 20 },
      { mapX: 609, mapY: 296, mapW: 32, mapH: 20 }
    ],
    carClue: {
      id: "car_drawing",
      touchRect: true,
      dialogue: [
        "A faded paper is taped to the car window.",
        "A child's drawing.",
        "\u2605  \u2605  \u2605",
        "\u201CThe stars used to sing.\u201D",
        "~You almost laugh. Kids have wild imaginations.~",
        "~You touch the drawing anyway.~"
      ],
      isClue: true
    },
    hotspots: []
  },

  {
    id: "stage2",
    label: "Stage 2 \u2014 5 years earlier",
    title: "WHEN PEOPLE LOOKED UP",
    map: "stage2",
    objective: "Follow the bird",
    objectivePaper: "Check what the bird left behind",
    objectiveAsk: "Ask someone about the folded paper",
    objectiveTree: "Find the tree around the park",
    onEnterDialogue: [
      "~The world lurches. Your stomach drops.~",
      "~That wasn't walking. That was falling sideways through years.~",
      "~You're not sure how you ended up here. But you're here now.~",
      "~It's different here. You look around and see things you've never seen before.~",
      "Color. Not vibrant \u2014 just alive.",
      "Birds. Street musicians. Someone waves at you.",
      "Nobody comments on any of it. This is just normal, here.",
      "~A blue bird watches you from the edge of a roof...~"
    ],
    birdQuest: {

      stops: [
        { x: 340, y: 250 },
        { x: 280, y: 170 },
        { x: 230, y: 120 }
      ],
      land: { x: 200, y: 90 },
      start: { x: 360, y: 290 }
    },
    paperHotspot: {
      id: "folded_paper",
      mapX: 200,
      mapY: 94,
      w: 48,
      h: 48,
      dialogue: [
        "The bird hops aside. A folded paper rests on the ground.",
        "It reads: \u201CYou're closer than you think.\u201D",
        "~You frown. Closer to what?~",
        "~Maybe someone around here knows what this means.~"
      ]
    },
    witness: {
      id: "star_drawing_person",
      dialogue: [
        "~You show them the folded paper.~",
        "They glance at it, then nod toward a child's star drawing pinned nearby.",
        "\u201CMy grandma says they used to sing.\u201D",
        "~You smile awkwardly.~",
        "\u201CThat's... nice.\u201D",
        "Under the drawing, someone has scrawled:",
        "\u201CLook beneath the tree.\u201D",
        "~There's a little park nearby...~"
      ]
    },
    treeHotspot: {
      id: "tree_box",

      mapX: 90,
      mapY: 60,
      mapW: 26,
      mapH: 30,
      touchRect: true,
      highlightW: 30,
      highlightH: 34,
      dialogue: [
        "At the base of the tree: a small metal box, half-buried in the roots.",
        "Inside \u2014 a weathered notebook page, torn clean from its spine.",
        "\u201CIf you're reading this...\u201D",
        "\u201CYou're closer than I ever was.\u201D",
        "\u201CKeep following the stars.\u201D",
        "\u201CDon't forget the tree.\u201D",
        "No signature. No explanation. Just those four lines.",
        "~Someone left this here...~",
        "~...for me?~",
        "~You touch the page.~"
      ],
      isClue: true
    },
    hotspots: []
  },

  {
    id: "stage3",
    label: "Stage 3 \u2014 years earlier",
    title: "WHEN THE WORLD STILL SANG",
    map: "scene3map",
    objective: "Speak with the people here",
    objectiveExplore: "Find the final witness.",
    objectiveClueProgress: "Find the final clues. ({n}/3)",
    objectiveFinal: "Look behind the giant oak.",
    excludeNpcSet: 2,
    chickens: [
      { x: 200, y: 220 },
      { x: 420, y: 150 },
      { x: 90, y: 200 },
      { x: 480, y: 240 }
    ],
    onEnterDialogue: [
      "~Another jump. Your ears ring like someone snapped the sky.~",
      "~The city is gone. Dirt paths. Flowers. A river that actually sings.~",
      "~You almost wish you could stay.~",
      "~A quieter question settles in: why was I brought here?~",
      "~Start with the people marked with !. Someone here must know something.~"
    ],
    interviews: [
      {
        id: "villager1",
        dialogue: [
          "Beautiful afternoon, isn't it?",
          "You look like you've walked a long way."
        ]
      },
      {
        id: "villager2",
        dialogue: [
          "The children were chasing chickens earlier.",
          "Nobody's in a hurry here. Nowhere to hurry to."
        ]
      },
      {
        id: "villager3",
        dialogue: [
          "That oak has been here longer than any of us.",
          "People leave things beneath it, sometimes. Notes. Wishes.",
          "I never ask why."
        ]
      }
    ],
    exploreIntroDialogue: [
      "~The villagers were kind... but none of them felt like the reason you're here.~",
      "~Someone near the bridge keeps glancing your way.~",
      "~A bird is watching you. And there's an old log by the houses...~",
      "~Look around. The final witness might not be who you expect.~"
    ],
    clueHintDialogue: {
      bridge: [
        "~\u201CNot yet.\u201D The words hang in the air.~",
        "~A bird is still watching from the rooftops.~",
        "~And that old log by the houses — maybe it isn't just driftwood.~"
      ],
      bird: [
        "~The bird led you to the oak — and nothing.~",
        "~Don't forget the log in front of the middle house.~"
      ],
      log: [
        "~\u201CKeep going.\u201D Carved for you. Or by you.~",
        "~That bird hasn't finished with you yet.~"
      ]
    },
    finalIntroDialogue: [
      "~The bridge. The bird. The log.~",
      "~All of it pointed back to the oak.~",
      "~Something is waiting behind the tree.~"
    ],

    bridgeWitness: {
      id: "bridge_person",
      mapX: 548,
      mapY: 302,
      dialogue: [
        "\u201CI've seen you before.\u201D",
        "\u201CWe've never met,\u201D you say.",
        "She smiles.",
        "\u201CNot yet.\u201D"
      ]
    },
    birdQuest: {
      hop: true,
      departAfterLand: true,
      start: { x: 240, y: 165 },
      stops: [
        { x: 210, y: 145 },
        { x: 175, y: 125 },
        { x: 150, y: 108 }
      ],
      land: { x: 138, y: 98 }
    },
    logHotspot: {
      id: "carved_log",

      mapX: 271,
      mapY: 151,
      mapW: 32,
      mapH: 16,
      touchRect: true,
      dialogue: [
        "Carved into the wood:",
        "\u201CKeep going.\u201D",
        "No initials. No date. No signature.",
        "~Who keeps leaving these?~"
      ]
    },
    barkHotspot: {
      id: "oak_bark",
      mapX: 145,
      mapY: 105,
      w: 36,
      h: 36,
      oneTimeDialogue: true,
      dialogue: [
        "~You rest a hand on the bark.~",
        "~It feels... familiar.~"
      ]
    },
    finalHotspot: {
      id: "oak_notebook",

      mapX: 92,
      mapY: 116,
      mapW: 36,
      mapH: 28,
      touchRect: true,
      highlightW: 34,
      highlightH: 30,
      dialogue: [
        "Behind the oak: a small notebook page, tucked in the roots.",
        "It reads:",
        "\u201COne more step.\u201D",
        "\u201CI'll be waiting.\u201D",
        "~Still unsigned. Still impossible.~",
        "~You touch it.~"
      ],
      isClue: true
    },
    hotspots: []
  },

  {
    id: "stage4",
    label: "Stage 4",
    title: "BEFORE WE FORGOT",
    map: "scene4map",
    night: true,

    ambientCount: 0,
    spawn: { x: 360, y: 216 },

    childNpc: {
      id: "child",
      mapX: 96,
      mapY: 100,
      npcSet: 0,
      className: "child",
      scale: 0.88,
      dir: "down"
    },

    childGreeting: [
      "\u201CYou finally made it.\u201D",
      "\u201C...Were you waiting for me?\u201D",
      "The child nods.",
      "\u201CI've always been waiting.\u201D",
      "\u201CDo you know what's happening?\u201D",
      "The child closes a notebook and gently places it in your hands.",
      "It is completely blank.",
      "\u201CI couldn't write it.\u201D",
      "\u201CYou have to.\u201D"
    ],

    notebookWriting: [
      "The notebook opens by itself.",
      "Your hand begins to move.",
      "One by one, every clue appears on its pages.",
      "The faded drawing.",
      "The notebook page.",
      "The carved message.",
      "~Every clue you followed... was never left by a stranger.~",
      "~They were left by you.~",
      "~There was never another investigator.~",
      "~Only someone making sure the path could always be found again.~",
      "The notebook closes."
    ],

    afterWriting: [
      "\u201C...Why?\u201D",
      "The child smiles.",
      "\u201CBecause someone wrote it for you.\u201D",
      "Silence.",
      "\u201CIf nobody remembers...\u201D",
      "\u201C...then nobody comes.\u201D",
      "\u201CAnd if nobody comes...\u201D",
      "\u201C...the stars are forgotten forever.\u201D"
    ],
    listenLine: [
      "\u201CDo you hear them?\u201D"
    ],
    afterStars: [
      "~You finally looked up and saw the stars.~",
      "\u201CSee?\u201D",
      "You reach for memories of your past.",
      "Your apartment.",
      "Nothing.",
      "Your family.",
      "Nothing.",
      "Even your own name...",
      "Nothing.",
      "\u201CEvery answer asks for something in return.\u201D",
      "The child gently taps the notebook.",
      "\u201CTo remember the world...\u201D",
      "\u201C...you had to forget yourself.\u201D",
      "\u201CCan I change the future?\u201D, you ask.",
      "The child looks toward the stars.",
      "\u201CThe future was never broken.\u201D",
      "\u201CPeople simply stopped looking up.\u201D",
      "\u201CSo what is your choice?\u201D"
    ],
    hotspots: []
  }

];

const ENDINGS = {
  remember: [
    "You awaken back in the gray city — exactly where you began.",
    "Everything is ordinary again.",
    "As you start to walk away, a small child stops in the middle of the sidewalk.",
    "They look up at the sky. Smile.",
    "\u201CCan you hear them too?\u201D",
    "For a brief moment, a single musical note.",
    "You pause."
  ],
  forget: [
    "You remain beneath the tree.",
    "Years pass. Decades. Centuries.",
    "You become the unseen caretaker of the notebook —",
    "preserving the path for the next traveler.",
    "The world pulls away.",
    "Only the tree. The stars. And their quiet song.",
    "And somewhere, someday...",
    "...someone will find the first clue."
  ]
};

const ENDING_QUOTE =
  "The stars never stopped singing.\nWe simply forgot how to listen.";
const ENDING_QUOTE_ATTR = "\u2014 Unknown";

const CREDITS = [
  "Bangzishu Huang",
  "Assets Used:\n\tRPG Urban Pack by Kenny\n\tCute Fantasy RPG by Kenmi\n\tPixel Art Bird 16x16 by ma9ici4n\n\tStar Image by Magnific",
  "Music:\n\tScene 1 BGM By Musictown from pixabay\n\tScene 2 BGM by Zakhar Valaha from pixabay\n\tScene 3 BGM by WELC0MEИ0 from pixabay\n\tEnding BGM by Aleksandr Abrosimov from pixabay",
  "Sound Effects:\n\tCity Walking by Diego Nasc from pixaBay\n\tGrass Walking by Joen TNT from pixabay\n\tClue by Neo Theone from pixabay\n\tTime Travel by Chrysalyn Chrysalyn from pixabay\n\tTitle Start by Universfield from pixabay\n\tTalking by CreatorsHome from pixabay\n\tCity Sounds by Наталья Баранова from pixabay\n\tNature Sounds by Alexander Jauk from pixabay\n\tWind Effects by storegraphic from pixabay\n\tStar Effects by Lof Cosmos from pixabay",
  "Thank you for looking up."
];
