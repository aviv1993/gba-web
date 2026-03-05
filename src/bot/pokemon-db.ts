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

/**
 * National Dex ID → catch rate for Gen 3.
 * Source: Bulbapedia / pret/pokeruby base stats tables.
 */
const CATCH_RATES: Record<number, number> = {
  1: 45, 2: 45, 3: 45, 4: 45, 5: 45, 6: 45, 7: 45, 8: 45, 9: 45, 10: 255,
  11: 120, 12: 45, 13: 255, 14: 120, 15: 45, 16: 255, 17: 120, 18: 45, 19: 255, 20: 127,
  21: 255, 22: 90, 23: 255, 24: 90, 25: 190, 26: 75, 27: 255, 28: 90, 29: 235, 30: 120,
  31: 45, 32: 235, 33: 120, 34: 45, 35: 150, 36: 25, 37: 190, 38: 75, 39: 170, 40: 50,
  41: 255, 42: 90, 43: 255, 44: 120, 45: 45, 46: 190, 47: 75, 48: 190, 49: 75, 50: 255,
  51: 50, 52: 255, 53: 90, 54: 190, 55: 75, 56: 190, 57: 75, 58: 190, 59: 75, 60: 255,
  61: 120, 62: 45, 63: 200, 64: 100, 65: 50, 66: 180, 67: 90, 68: 45, 69: 255, 70: 120,
  71: 45, 72: 190, 73: 60, 74: 255, 75: 120, 76: 45, 77: 190, 78: 60, 79: 190, 80: 75,
  81: 190, 82: 60, 83: 45, 84: 190, 85: 45, 86: 190, 87: 75, 88: 190, 89: 75, 90: 190,
  91: 60, 92: 190, 93: 90, 94: 45, 95: 45, 96: 190, 97: 75, 98: 225, 99: 60, 100: 190,
  101: 60, 102: 90, 103: 45, 104: 190, 105: 75, 106: 45, 107: 45, 108: 45, 109: 190, 110: 60,
  111: 120, 112: 60, 113: 30, 114: 45, 115: 45, 116: 225, 117: 75, 118: 225, 119: 60, 120: 225,
  121: 60, 122: 45, 123: 45, 124: 45, 125: 45, 126: 45, 127: 45, 128: 45, 129: 255, 130: 45,
  131: 45, 132: 35, 133: 45, 134: 45, 135: 45, 136: 45, 137: 45, 138: 45, 139: 45, 140: 45,
  141: 45, 142: 45, 143: 25, 144: 3, 145: 3, 146: 3, 147: 45, 148: 45, 149: 45, 150: 3,
  151: 45, 152: 45, 153: 45, 154: 45, 155: 45, 156: 45, 157: 45, 158: 45, 159: 45, 160: 45,
  161: 255, 162: 90, 163: 255, 164: 90, 165: 255, 166: 90, 167: 255, 168: 90, 169: 90, 170: 190,
  171: 75, 172: 190, 173: 150, 174: 170, 175: 190, 176: 75, 177: 190, 178: 75, 179: 235, 180: 120,
  181: 45, 182: 45, 183: 190, 184: 75, 185: 65, 186: 45, 187: 255, 188: 120, 189: 45, 190: 45,
  191: 235, 192: 120, 193: 75, 194: 255, 195: 90, 196: 45, 197: 45, 198: 30, 199: 70, 200: 45,
  201: 225, 202: 45, 203: 60, 204: 190, 205: 75, 206: 190, 207: 60, 208: 25, 209: 190, 210: 75,
  211: 45, 212: 25, 213: 190, 214: 45, 215: 60, 216: 120, 217: 60, 218: 190, 219: 75, 220: 225,
  221: 75, 222: 60, 223: 190, 224: 75, 225: 45, 226: 25, 227: 25, 228: 120, 229: 45, 230: 45,
  231: 120, 232: 45, 233: 45, 234: 45, 235: 45, 236: 75, 237: 45, 238: 45, 239: 45, 240: 45,
  241: 45, 242: 30, 243: 3, 244: 3, 245: 3, 246: 45, 247: 45, 248: 45, 249: 3, 250: 3,
  251: 45, 252: 45, 253: 45, 254: 45, 255: 45, 256: 45, 257: 45, 258: 45, 259: 45, 260: 45,
  261: 255, 262: 127, 263: 255, 264: 90, 265: 255, 266: 120, 267: 45, 268: 120, 269: 45, 270: 255,
  271: 120, 272: 45, 273: 255, 274: 120, 275: 45, 276: 200, 277: 45, 278: 190, 279: 45, 280: 235,
  281: 120, 282: 45, 283: 200, 284: 75, 285: 255, 286: 90, 287: 255, 288: 120, 289: 45, 290: 255,
  291: 120, 292: 45, 293: 190, 294: 120, 295: 45, 296: 180, 297: 200, 298: 150, 299: 255, 300: 255,
  301: 60, 302: 45, 303: 45, 304: 180, 305: 90, 306: 45, 307: 180, 308: 90, 309: 120, 310: 45,
  311: 200, 312: 200, 313: 150, 314: 150, 315: 150, 316: 225, 317: 75, 318: 225, 319: 60, 320: 125,
  321: 60, 322: 255, 323: 150, 324: 90, 325: 255, 326: 60, 327: 255, 328: 255, 329: 120, 330: 45,
  331: 190, 332: 60, 333: 255, 334: 45, 335: 90, 336: 90, 337: 45, 338: 45, 339: 190, 340: 75,
  341: 205, 342: 155, 343: 255, 344: 90, 345: 45, 346: 45, 347: 45, 348: 45, 349: 255, 350: 60,
  351: 45, 352: 200, 353: 225, 354: 45, 355: 190, 356: 90, 357: 200, 358: 45, 359: 30, 360: 125,
  361: 190, 362: 75, 363: 255, 364: 120, 365: 45, 366: 255, 367: 60, 368: 60, 369: 25, 370: 225,
  371: 45, 372: 45, 373: 45, 374: 3, 375: 3, 376: 3, 377: 3, 378: 3, 379: 3, 380: 3,
  381: 3, 382: 5, 383: 5, 384: 3, 385: 3, 386: 3,
};

/** Get catch rate for a National Dex ID. Returns 45 (default) if not found. */
export function getCatchRate(nationalId: number): number {
  return CATCH_RATES[nationalId] ?? 45;
}

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
 *
 * IMPORTANT: The Hoenn species (252+) have different internal IDs in US vs EU ROMs.
 * This table is for the EU ROM, dumped from the ROM's sSpeciesToNationalPokedexNum table.
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
  // Gen 3 Pokemon (Hoenn) — internal IDs for EU ROM (empirically dumped from ROM)
  // EU ROM has a different Hoenn species ordering than US ROM
  252: 277, 253: 278, 254: 279, 255: 280, 256: 281, 257: 282, 258: 283, 259: 284, 260: 285,
  261: 286, 262: 287, 263: 288, 264: 289, 265: 290, 266: 291, 267: 292, 268: 293, 269: 294,
  270: 295, 271: 296, 272: 297, 273: 298, 274: 299, 275: 300, 276: 304, 277: 305, 278: 309,
  279: 310, 280: 392, 281: 393, 282: 394, 283: 311, 284: 312, 285: 306, 286: 307, 287: 364,
  288: 365, 289: 366, 290: 301, 291: 302, 292: 303, 293: 370, 294: 371, 295: 372, 296: 335,
  297: 336, 298: 350, 299: 320, 300: 315, 301: 316, 302: 322, 303: 355, 304: 382, 305: 383,
  306: 384, 307: 356, 308: 357, 309: 337, 310: 338, 311: 353, 312: 354, 313: 386, 314: 387,
  315: 363, 316: 367, 317: 368, 318: 330, 319: 331, 320: 313, 321: 314, 322: 339, 323: 340,
  324: 321, 325: 351, 326: 352, 327: 308, 328: 332, 329: 333, 330: 334, 331: 344, 332: 345,
  333: 358, 334: 359, 335: 380, 336: 379, 337: 348, 338: 349, 339: 323, 340: 324, 341: 326,
  342: 327, 343: 318, 344: 319, 345: 388, 346: 389, 347: 390, 348: 391, 349: 328, 350: 329,
  351: 385, 352: 317, 353: 377, 354: 378, 355: 361, 356: 362, 357: 369, 358: 411, 359: 376,
  // 360 (Wynaut) = 360 (identity, omitted)
  361: 346, 362: 347, 363: 341, 364: 342, 365: 343, 366: 373, 367: 374, 368: 375, 369: 381,
  370: 325, 371: 395, 372: 396, 373: 397, 374: 398, 375: 399, 376: 400, 377: 401, 378: 402,
  379: 403, 380: 407, 381: 408, 382: 404, 383: 405, 384: 406, 385: 409, 386: 410,
  387: 252, 388: 253, 389: 254, 390: 255, 391: 256, 392: 257, 393: 258, 394: 259, 395: 260,
  396: 261, 397: 262, 398: 263, 399: 264, 400: 265, 401: 266, 402: 267, 403: 268, 404: 269,
  405: 270, 406: 271, 407: 272, 408: 273, 409: 274, 410: 275, 411: 276,
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
