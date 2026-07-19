// City V2 is authored as a road-first network. Every ordinary junction has at
// most four approaches, so the renderer never has to hide an eight-way node
// under a giant asphalt patch.
export const CITY_V2_NODES = {
  northWest: { x: -160, z: -190 }, northCenter: { x: 0, z: -210 }, northEast: { x: 160, z: -190 },
  midWest: { x: -160, z: -90 }, midCenter: { x: 0, z: -90 }, midEast: { x: 160, z: -90 },
  westCivic: { x: -160, z: 20 }, hub: { x: 0, z: 20 }, eastCivic: { x: 160, z: 20 },

  westBridgeN: { x: -160, z: 96 }, centerBridgeN: { x: 0, z: 96 }, eastBridgeN: { x: 160, z: 96 },
  westBridgeS: { x: -160, z: 160 }, centerBridgeS: { x: 0, z: 160 }, eastBridgeS: { x: 160, z: 160 },
  westHarbor: { x: -160, z: 198 }, centerHarbor: { x: 0, z: 198 }, eastHarbor: { x: 160, z: 198 },
  harborWest: { x: -160, z: 260 }, harborCenter: { x: 0, z: 260 }, harborEast: { x: 160, z: 260 },

  outerNW: { x: -280, z: -210 }, outerN: { x: 0, z: -290 }, outerNE: { x: 280, z: -210 }, outerE: { x: 305, z: 25 },
  outerSE: { x: 275, z: 235 }, outerS: { x: 0, z: 310 }, outerSW: { x: -275, z: 235 }, outerW: { x: -305, z: 25 },

  school: { x: -150, z: -236 }, library: { x: 270, z: -150 }, museum: { x: -278, z: 64 },
  park: { x: 78, z: 252 }, observatory: { x: 282, z: 236 }, jumpLaunch: { x: -248, z: -116 }
};

const straight = { straight: true };
const bridge = { bridge: true, straight: true };

export const CITY_V2_ROAD_SPECS = [
  // Three long north-south avenues form the readable downtown backbone.
  ["west-avenue-north", "northWest", "midWest", "arterial", [], straight],
  ["west-avenue-civic", "midWest", "westCivic", "arterial", [], straight],
  ["west-avenue-river", "westCivic", "westBridgeN", "arterial", [], straight],
  ["central-avenue-north", "northCenter", "midCenter", "arterial", [], straight],
  ["central-avenue-civic", "midCenter", "hub", "arterial", [], straight],
  ["central-avenue-river", "hub", "centerBridgeN", "arterial", [], straight],
  ["east-avenue-north", "northEast", "midEast", "arterial", [], straight],
  ["east-avenue-civic", "midEast", "eastCivic", "arterial", [], straight],
  ["east-avenue-river", "eastCivic", "eastBridgeN", "arterial", [], straight],

  // Parallel cross streets create rectangular blocks instead of random spokes.
  ["north-boulevard-west", "northWest", "northCenter", "collector", [[-82, -205]]],
  ["north-boulevard-east", "northCenter", "northEast", "collector", [[82, -205]]],
  ["mid-boulevard-west", "midWest", "midCenter", "collector", [], straight],
  ["mid-boulevard-east", "midCenter", "midEast", "collector", [], straight],
  ["civic-boulevard-west", "westCivic", "hub", "collector", [], straight],
  ["civic-boulevard-east", "hub", "eastCivic", "collector", [], straight],
  ["riverfront-north-west", "westBridgeN", "centerBridgeN", "scenic", [], straight],
  ["riverfront-north-east", "centerBridgeN", "eastBridgeN", "scenic", [], straight],

  // Three proper bridge corridors cross the canal without overlapping roads.
  ["west-bridge", "westBridgeN", "westBridgeS", "arterial", [], bridge],
  ["center-bridge", "centerBridgeN", "centerBridgeS", "arterial", [], bridge],
  ["east-bridge", "eastBridgeN", "eastBridgeS", "arterial", [], bridge],
  ["west-harbor-entry", "westBridgeS", "westHarbor", "arterial", [], straight],
  ["center-harbor-entry", "centerBridgeS", "centerHarbor", "arterial", [], straight],
  ["east-harbor-entry", "eastBridgeS", "eastHarbor", "arterial", [], straight],
  ["harbor-boulevard-west", "westHarbor", "centerHarbor", "collector", [], straight],
  ["harbor-boulevard-east", "centerHarbor", "eastHarbor", "collector", [], straight],
  ["west-promenade-entry", "westHarbor", "harborWest", "collector", [], straight],
  ["center-promenade-entry", "centerHarbor", "harborCenter", "collector", [], straight],
  ["east-promenade-entry", "eastHarbor", "harborEast", "collector", [], straight],
  ["harbor-promenade-west", "harborWest", "harborCenter", "scenic", [[-80, 270]]],
  ["harbor-promenade-park", "harborCenter", "park", "scenic", [[38, 270]]],
  ["harbor-promenade-east", "park", "harborEast", "scenic", [[118, 266]]],

  // A broad, continuous outer loop provides the 200-300 km/h course.
  ["outer-north-west", "outerNW", "outerN", "arterial", [[-148, -286]]],
  ["outer-north-east", "outerN", "outerNE", "arterial", [[148, -286]]],
  ["outer-east-north", "outerNE", "outerE", "arterial", [[314, -105]]],
  ["outer-east-south", "outerE", "outerSE", "arterial", [[316, 142]]],
  ["outer-south-east", "outerSE", "outerS", "arterial", [[148, 310]]],
  ["outer-south-west", "outerS", "outerSW", "arterial", [[-148, 310]]],
  ["outer-west-south", "outerSW", "outerW", "arterial", [[-316, 142]]],
  ["outer-west-north", "outerW", "outerNW", "arterial", [[-316, -106]]],

  // Each outer-loop ramp lands on a junction with an available approach.
  ["link-north-west", "outerNW", "northWest", "collector", [], straight],
  ["link-north", "outerN", "northCenter", "collector", [], straight],
  ["link-north-east", "outerNE", "northEast", "collector", [], straight],
  ["link-east", "outerE", "eastCivic", "collector", [], straight],
  ["link-south-east", "outerSE", "observatory", "collector", [], straight],
  ["link-south", "outerS", "harborCenter", "collector", [], straight],
  ["link-south-west", "outerSW", "harborWest", "collector", [], straight],
  ["link-west", "outerW", "museum", "collector", [], straight],

  // Destination access roads terminate outside the through lanes.
  ["school-access", "northWest", "school", "local", [[-156, -220]]],
  ["library-access", "northEast", "library", "local", [[220, -185]]],
  ["museum-access", "museum", "westCivic", "local", [[-226, 54]]]
];

export const CITY_V2_TRAFFIC_LOOPS = {
  outer: [
    "outer-north-west", "outer-north-east", "outer-east-north", "outer-east-south",
    "outer-south-east", "outer-south-west", "outer-west-south", "outer-west-north"
  ],
  inner: [
    "north-boulevard-west", "north-boulevard-east", "east-avenue-north", "east-avenue-civic",
    "east-avenue-river", "riverfront-north-east", "riverfront-north-west", "west-avenue-river",
    "west-avenue-civic", "west-avenue-north"
  ]
};
