/**
 * National Dex ID → name mapping for Gen 3 (Pokemon Ruby/Sapphire).
 * Used to validate user input and match against memory-read species IDs.
 */
const POKEMON_NAMES: Record<number, string> = {
  1: 'Bulbasaur', 2: 'Ivysaur', 3: 'Venusaur', 4: 'Charmander', 5: 'Charmeleon',
  6: 'Charizard', 7: 'Squirtle', 8: 'Wartortle', 9: 'Blastoise', 10: 'Caterpie',
  11: 'Metapod', 12: 'Butterfree', 13: 'Weedle', 14: 'Kakuna', 15: 'Beedrill',
  16: 'Pidgey', 17: 'Pidgeotto', 18: 'Pidgeot', 19: 'Rattata', 20: 'Raticate',
  21: 'Spearow', 22: 'Fearow', 23: 'Ekans', 24: 'Arbok', 25: 'Pikachu',
  26: 'Raichu', 27: 'Sandshrew', 28: 'Sandslash', 29: 'Nidoran♀', 30: 'Nidorina',
  31: 'Nidoqueen', 32: 'Nidoran♂', 33: 'Nidorino', 34: 'Nidoking', 35: 'Clefairy',
  36: 'Clefable', 37: 'Vulpix', 38: 'Ninetales', 39: 'Jigglypuff', 40: 'Wigglytuff',
  41: 'Zubat', 42: 'Golbat', 43: 'Oddish', 44: 'Gloom', 45: 'Vileplume',
  46: 'Paras', 47: 'Parasect', 48: 'Venonat', 49: 'Venomoth', 50: 'Diglett',
  51: 'Dugtrio', 52: 'Meowth', 53: 'Persian', 54: 'Psyduck', 55: 'Golduck',
  56: 'Mankey', 57: 'Primeape', 58: 'Growlithe', 59: 'Arcanine', 60: 'Poliwag',
  61: 'Poliwhirl', 62: 'Poliwrath', 63: 'Abra', 64: 'Kadabra', 65: 'Alakazam',
  66: 'Machop', 67: 'Machoke', 68: 'Machamp', 69: 'Bellsprout', 70: 'Weepinbell',
  71: 'Victreebel', 72: 'Tentacool', 73: 'Tentacruel', 74: 'Geodude', 75: 'Graveler',
  76: 'Golem', 77: 'Ponyta', 78: 'Rapidash', 79: 'Slowpoke', 80: 'Slowbro',
  81: 'Magnemite', 82: 'Magneton', 83: "Farfetch'd", 84: 'Doduo', 85: 'Dodrio',
  86: 'Seel', 87: 'Dewgong', 88: 'Grimer', 89: 'Muk', 90: 'Shellder',
  91: 'Cloyster', 92: 'Gastly', 93: 'Haunter', 94: 'Gengar', 95: 'Onix',
  96: 'Drowzee', 97: 'Hypno', 98: 'Krabby', 99: 'Kingler', 100: 'Voltorb',
  101: 'Electrode', 102: 'Exeggcute', 103: 'Exeggutor', 104: 'Cubone', 105: 'Marowak',
  106: 'Hitmonlee', 107: 'Hitmonchan', 108: 'Lickitung', 109: 'Koffing', 110: 'Weezing',
  111: 'Rhyhorn', 112: 'Rhydon', 113: 'Chansey', 114: 'Tangela', 115: 'Kangaskhan',
  116: 'Horsea', 117: 'Seadra', 118: 'Goldeen', 119: 'Seaking', 120: 'Staryu',
  121: 'Starmie', 122: 'Mr. Mime', 123: 'Scyther', 124: 'Jynx', 125: 'Electabuzz',
  126: 'Magmar', 127: 'Pinsir', 128: 'Tauros', 129: 'Magikarp', 130: 'Gyarados',
  131: 'Lapras', 132: 'Ditto', 133: 'Eevee', 134: 'Vaporeon', 135: 'Jolteon',
  136: 'Flareon', 137: 'Porygon', 138: 'Omanyte', 139: 'Omastar', 140: 'Kabuto',
  141: 'Kabutops', 142: 'Aerodactyl', 143: 'Snorlax', 144: 'Articuno', 145: 'Zapdos',
  146: 'Moltres', 147: 'Dratini', 148: 'Dragonair', 149: 'Dragonite', 150: 'Mewtwo',
  151: 'Mew', 152: 'Chikorita', 153: 'Bayleef', 154: 'Meganium', 155: 'Cyndaquil',
  156: 'Quilava', 157: 'Typhlosion', 158: 'Totodile', 159: 'Croconaw', 160: 'Feraligatr',
  161: 'Sentret', 162: 'Furret', 163: 'Hoothoot', 164: 'Noctowl', 165: 'Ledyba',
  166: 'Ledian', 167: 'Spinarak', 168: 'Ariados', 169: 'Crobat', 170: 'Chinchou',
  171: 'Lanturn', 172: 'Pichu', 173: 'Cleffa', 174: 'Igglybuff', 175: 'Togepi',
  176: 'Togetic', 177: 'Natu', 178: 'Xatu', 179: 'Mareep', 180: 'Flaaffy',
  181: 'Ampharos', 182: 'Bellossom', 183: 'Marill', 184: 'Azumarill', 185: 'Sudowoodo',
  186: 'Politoed', 187: 'Hoppip', 188: 'Skiploom', 189: 'Jumpluff', 190: 'Aipom',
  191: 'Sunkern', 192: 'Sunflora', 193: 'Yanma', 194: 'Wooper', 195: 'Quagsire',
  196: 'Espeon', 197: 'Umbreon', 198: 'Murkrow', 199: 'Slowking', 200: 'Misdreavus',
  201: 'Unown', 202: 'Wobbuffet', 203: 'Girafarig', 204: 'Pineco', 205: 'Forretress',
  206: 'Dunsparce', 207: 'Gligar', 208: 'Steelix', 209: 'Snubbull', 210: 'Granbull',
  211: 'Qwilfish', 212: 'Scizor', 213: 'Shuckle', 214: 'Heracross', 215: 'Sneasel',
  216: 'Teddiursa', 217: 'Ursaring', 218: 'Slugma', 219: 'Magcargo', 220: 'Swinub',
  221: 'Piloswine', 222: 'Corsola', 223: 'Remoraid', 224: 'Octillery', 225: 'Delibird',
  226: 'Mantine', 227: 'Skarmory', 228: 'Houndour', 229: 'Houndoom', 230: 'Kingdra',
  231: 'Phanpy', 232: 'Donphan', 233: 'Porygon2', 234: 'Stantler', 235: 'Smeargle',
  236: 'Tyrogue', 237: 'Hitmontop', 238: 'Smoochum', 239: 'Elekid', 240: 'Magby',
  241: 'Miltank', 242: 'Blissey', 243: 'Raikou', 244: 'Entei', 245: 'Suicune',
  246: 'Larvitar', 247: 'Pupitar', 248: 'Tyranitar', 249: 'Lugia', 250: 'Ho-Oh',
  251: 'Celebi', 252: 'Treecko', 253: 'Grovyle', 254: 'Sceptile', 255: 'Torchic',
  256: 'Combusken', 257: 'Blaziken', 258: 'Mudkip', 259: 'Marshtomp', 260: 'Swampert',
  261: 'Poochyena', 262: 'Mightyena', 263: 'Zigzagoon', 264: 'Linoone', 265: 'Wurmple',
  266: 'Silcoon', 267: 'Beautifly', 268: 'Cascoon', 269: 'Dustox', 270: 'Lotad',
  271: 'Lombre', 272: 'Ludicolo', 273: 'Seedot', 274: 'Nuzleaf', 275: 'Shiftry',
  276: 'Taillow', 277: 'Swellow', 278: 'Wingull', 279: 'Pelipper', 280: 'Ralts',
  281: 'Kirlia', 282: 'Gardevoir', 283: 'Surskit', 284: 'Masquerain', 285: 'Shroomish',
  286: 'Breloom', 287: 'Slakoth', 288: 'Vigoroth', 289: 'Slaking', 290: 'Nincada',
  291: 'Ninjask', 292: 'Shedinja', 293: 'Whismur', 294: 'Loudred', 295: 'Exploud',
  296: 'Makuhita', 297: 'Hariyama', 298: 'Azurill', 299: 'Nosepass', 300: 'Skitty',
  301: 'Delcatty', 302: 'Sableye', 303: 'Mawile', 304: 'Aron', 305: 'Lairon',
  306: 'Aggron', 307: 'Meditite', 308: 'Medicham', 309: 'Electrike', 310: 'Manectric',
  311: 'Plusle', 312: 'Minun', 313: 'Volbeat', 314: 'Illumise', 315: 'Roselia',
  316: 'Gulpin', 317: 'Swalot', 318: 'Carvanha', 319: 'Sharpedo', 320: 'Wailmer',
  321: 'Wailord', 322: 'Numel', 323: 'Camerupt', 324: 'Torkoal', 325: 'Spoink',
  326: 'Grumpig', 327: 'Spinda', 328: 'Trapinch', 329: 'Vibrava', 330: 'Flygon',
  331: 'Cacnea', 332: 'Cacturne', 333: 'Swablu', 334: 'Altaria', 335: 'Zangoose',
  336: 'Seviper', 337: 'Lunatone', 338: 'Solrock', 339: 'Barboach', 340: 'Whiscash',
  341: 'Corphish', 342: 'Crawdaunt', 343: 'Baltoy', 344: 'Claydol', 345: 'Lileep',
  346: 'Cradily', 347: 'Anorith', 348: 'Armaldo', 349: 'Feebas', 350: 'Milotic',
  351: 'Castform', 352: 'Kecleon', 353: 'Shuppet', 354: 'Banette', 355: 'Duskull',
  356: 'Dusclops', 357: 'Tropius', 358: 'Chimecho', 359: 'Absol', 360: 'Wynaut',
  361: 'Snorunt', 362: 'Glalie', 363: 'Spheal', 364: 'Sealeo', 365: 'Walrein',
  366: 'Clamperl', 367: 'Huntail', 368: 'Gorebyss', 369: 'Relicanth', 370: 'Luvdisc',
  371: 'Bagon', 372: 'Shelgon', 373: 'Salamence', 374: 'Beldum', 375: 'Metang',
  376: 'Metagross', 377: 'Regirock', 378: 'Regice', 379: 'Registeel', 380: 'Latias',
  381: 'Latios', 382: 'Kyogre', 383: 'Groudon', 384: 'Rayquaza', 385: 'Jirachi',
  386: 'Deoxys',
};

/** Reverse lookup: lowercase name → National Dex ID */
const NAME_TO_ID: Record<string, number> = {};
for (const [id, name] of Object.entries(POKEMON_NAMES)) {
  NAME_TO_ID[name.toLowerCase()] = Number(id);
}

/** Get National Dex ID from name (case-insensitive). Returns undefined if not found. */
export function getSpeciesId(name: string): number | undefined {
  return NAME_TO_ID[name.toLowerCase()];
}

/** Get Pokemon name from National Dex ID. Returns undefined if not found. */
export function getSpeciesName(id: number): string | undefined {
  return POKEMON_NAMES[id];
}

/** Check if a name is a valid Gen 3 Pokemon. */
export function isValidPokemon(name: string): boolean {
  return name.toLowerCase() in NAME_TO_ID;
}

/**
 * Gen 3 games use an internal species index that differs from the National Dex.
 * This maps National Dex ID → internal Gen 3 species index used in memory.
 */
const NATIONAL_TO_INTERNAL: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20,
  21: 21, 22: 22, 23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30,
  31: 31, 32: 32, 33: 33, 34: 34, 35: 35, 36: 36, 37: 37, 38: 38, 39: 39, 40: 40,
  41: 41, 42: 42, 43: 43, 44: 44, 45: 45, 46: 46, 47: 47, 48: 48, 49: 49, 50: 50,
  51: 51, 52: 52, 53: 53, 54: 54, 55: 55, 56: 56, 57: 57, 58: 58, 59: 59, 60: 60,
  61: 61, 62: 62, 63: 63, 64: 64, 65: 65, 66: 66, 67: 67, 68: 68, 69: 69, 70: 70,
  71: 71, 72: 72, 73: 73, 74: 74, 75: 75, 76: 76, 77: 77, 78: 78, 79: 79, 80: 80,
  81: 81, 82: 82, 83: 83, 84: 84, 85: 85, 86: 86, 87: 87, 88: 88, 89: 89, 90: 90,
  91: 91, 92: 92, 93: 93, 94: 94, 95: 95, 96: 96, 97: 97, 98: 98, 99: 99, 100: 100,
  101: 101, 102: 102, 103: 103, 104: 104, 105: 105, 106: 106, 107: 107, 108: 108, 109: 109, 110: 110,
  111: 111, 112: 112, 113: 113, 114: 114, 115: 115, 116: 116, 117: 117, 118: 118, 119: 119, 120: 120,
  121: 121, 122: 122, 123: 123, 124: 124, 125: 125, 126: 126, 127: 127, 128: 128, 129: 129, 130: 130,
  131: 131, 132: 132, 133: 133, 134: 134, 135: 135, 136: 136, 137: 137, 138: 138, 139: 139, 140: 140,
  141: 141, 142: 142, 143: 143, 144: 144, 145: 145, 146: 146, 147: 147, 148: 148, 149: 149, 150: 150,
  151: 151, 152: 152, 153: 153, 154: 154, 155: 155, 156: 156, 157: 157, 158: 158, 159: 159, 160: 160,
  161: 161, 162: 162, 163: 163, 164: 164, 165: 165, 166: 166, 167: 167, 168: 168, 169: 169, 170: 170,
  171: 171, 172: 172, 173: 173, 174: 174, 175: 175, 176: 176, 177: 177, 178: 178, 179: 179, 180: 180,
  181: 181, 182: 182, 183: 183, 184: 184, 185: 185, 186: 186, 187: 187, 188: 188, 189: 189, 190: 190,
  191: 191, 192: 192, 193: 193, 194: 194, 195: 195, 196: 196, 197: 197, 198: 198, 199: 199, 200: 200,
  201: 201, 202: 202, 203: 203, 204: 204, 205: 205, 206: 206, 207: 207, 208: 208, 209: 209, 210: 210,
  211: 211, 212: 212, 213: 213, 214: 214, 215: 215, 216: 216, 217: 217, 218: 218, 219: 219, 220: 220,
  221: 221, 222: 222, 223: 223, 224: 224, 225: 225, 226: 226, 227: 227, 228: 228, 229: 229, 230: 230,
  231: 231, 232: 232, 233: 233, 234: 234, 235: 235, 236: 236, 237: 237, 238: 238, 239: 239, 240: 240,
  241: 241, 242: 242, 243: 243, 244: 244, 245: 245, 246: 246, 247: 247, 248: 248, 249: 249, 250: 250,
  251: 251,
  // Gen 3 Pokemon (Hoenn) — internal IDs differ from National Dex
  252: 277, 253: 278, 254: 279, 255: 280, 256: 281, 257: 282, 258: 283, 259: 284, 260: 285,
  261: 286, 262: 287, 263: 288, 264: 289, 265: 290, 266: 291, 267: 292, 268: 293, 269: 294,
  270: 295, 271: 296, 272: 297, 273: 298, 274: 299, 275: 300, 276: 301, 277: 302, 278: 303,
  279: 304, 280: 305, 281: 306, 282: 307, 283: 308, 284: 309, 285: 310, 286: 311, 287: 312,
  288: 313, 289: 314, 290: 315, 291: 316, 292: 317, 293: 318, 294: 319, 295: 320, 296: 321,
  297: 322, 298: 323, 299: 324, 300: 325, 301: 326, 302: 327, 303: 328, 304: 329, 305: 330,
  306: 331, 307: 332, 308: 333, 309: 334, 310: 335, 311: 336, 312: 337, 313: 338, 314: 339,
  315: 340, 316: 341, 317: 342, 318: 343, 319: 344, 320: 345, 321: 346, 322: 347, 323: 348,
  324: 349, 325: 350, 326: 351, 327: 352, 328: 353, 329: 354, 330: 355, 331: 356, 332: 357,
  333: 358, 334: 359, 335: 360, 336: 361, 337: 362, 338: 363, 339: 364, 340: 365, 341: 366,
  342: 367, 343: 368, 344: 369, 345: 370, 346: 371, 347: 372, 348: 373, 349: 374, 350: 375,
  351: 376, 352: 377, 353: 378, 354: 379, 355: 380, 356: 381, 357: 382, 358: 383, 359: 384,
  360: 385, 361: 386, 362: 387, 363: 388, 364: 389, 365: 390, 366: 391, 367: 392, 368: 393,
  369: 394, 370: 395, 371: 396, 372: 397, 373: 398, 374: 399, 375: 400, 376: 401,
  377: 402, 378: 403, 379: 404, 380: 405, 381: 406, 382: 407, 383: 408, 384: 409,
  385: 410, 386: 411,
};

/** Reverse: internal → National Dex */
const INTERNAL_TO_NATIONAL: Record<number, number> = {};
for (const [nat, internal] of Object.entries(NATIONAL_TO_INTERNAL)) {
  INTERNAL_TO_NATIONAL[Number(internal)] = Number(nat);
}

/** Convert National Dex ID to Gen 3 internal species index. */
export function nationalToInternal(nationalId: number): number {
  return NATIONAL_TO_INTERNAL[nationalId] ?? nationalId;
}

/** Convert Gen 3 internal species index to National Dex ID. */
export function internalToNational(internalId: number): number {
  return INTERNAL_TO_NATIONAL[internalId] ?? internalId;
}
