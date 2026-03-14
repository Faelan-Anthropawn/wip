const exact = new Set([
  "minecraft:air", "minecraft:azalea", "minecraft:pale_hanging_moss", "minecraft:lever", "minecraft:hopper", "minecraft:heavy_core", "minecraft:glow_lichen", "minecraft:mangrove_propagule", "minecraft:dandelion", "minecraft:poppy", "minecraft:blue_orchid", "minecraft:allium", "minecraft:azure_bluet", "minecraft:oxeye_daisy", "minecraft:wither_rose", "minecraft:peony", "minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroots", "minecraft:melon_stem", "minecraft:pumpkin_stem", "minecraft:cocoa", "minecraft:nether_wart", "minecraft:bamboo", "minecraft:sugar_cane", "minecraft:kelp", "minecraft:seagrass", "minecraft:sea_pickle", "minecraft:red_mushroom", "minecraft:brown_mushroom", "minecraft:decorated_pot", "minecraft:vault", "minecraft:leaf_litter", "minecraft:pink_petals", "minecraft:nether_sprouts", "minecraft:pitcher_crop", "minecraft:open_eyeblossom", "minecraft:closed_eyeblossom", "minecraft:portal", "minecraft:end_portal_frame", "minecraft:lantern", "minecraft:campfire", "minecraft:soul_campfire", "minecraft:brewing_stand", "minecraft:grindstone", "minecraft:enchanting_table", "minecraft:lectern", "minecraft:redstone_wire", "minecraft:repeater", "minecraft:comparator", "minecraft:bed", "minecraft:ladder", "minecraft:scaffolding", "minecraft:bell", "minecraft:tripwire", "minecraft:string", "minecraft:painting", "minecraft:item_frame", "minecraft:glow_item_frame", "minecraft:barrier", "minecraft:web", "minecraft:beacon", "minecraft:conduit", "minecraft:stonecutter_block", "minecraft:frog_spawn", "minecraft:amethyst_cluster", "minecraft:structure_void", "minecraft:grass_path", "minecraft:farmland", "minecraft:resin_clump", "minecraft:ominous_vault", "minecraft:dried_ghast", "minecraft:ice", "minecraft:honey_block", "minecraft:slime", "minecraft:light_block", "minecraft:tripwire_hook", "minecraft:snow_layer", "minecraft:powder_snow"
]);

const includes = [
  "_leaves", "water", "_slab", "_stairs", "_shelf", "_door", "trapdoor", "_button", "pressure_plate", "glass", "_egg", "cake", "chest", "rail", "candle", "_wall", "_fence", "_coral", "chain", "sign", "_statue", "sapling", "anvil", "banner", "vine", "carpet", "_bar", "cactus", "_lantern", "_tulip", "_grate", "_grass", "bush", "fern", "torch", "rod", "_head", "flower", "_roots", "_plant", "_skull", "_bud", "lava", "_drip", ":lil", "spawner", "_golem",
];

function stripState(name) {
  return name ? name.split("[")[0] : "";
}

const NON_SOLID_BLOCKS = new Set(exact);

function matchesIncludes(name) {
  for (let k = 0; k < includes.length; k++) {
    if (name.includes(includes[k])) return true;
  }
  return false;
}

function isNonSolid(name) {
  if (!name) return false;
  const base = stripState(name);
  return NON_SOLID_BLOCKS.has(base) || matchesIncludes(base);
}

function makeIsSolidBlock() {
  const cache = new Map();
  return function isSolidBlock(name) {
    if (!name) return false;
    if (cache.has(name)) return cache.get(name);
    const solid = !isNonSolid(name);
    cache.set(name, solid);
    return solid;
  };
}

const isSolidBlock = makeIsSolidBlock();

const YIELD = () => new Promise(r => setTimeout(r, 0));

async function hollowOutSchematic(schem, baseGetKeyAt, onProgress) {
  const report = typeof onProgress === 'function' ? onProgress : () => {};
  const { width: w, height: h, length: l } = schem;
  const volume = w * h * l;
  const hollowMask = new Uint8Array(volume);

  const blocks     = schem.blocks;
  const paletteStr = schem.paletteStr;

  if (blocks instanceof Uint32Array && paletteStr && paletteStr.length > 0) {
    const palLen   = paletteStr.length;
    const solidPal = new Uint8Array(palLen);
    for (let p = 0; p < palLen; p++) {
      solidPal[p] = isSolidBlock(paletteStr[p]) ? 1 : 0;
    }

    let minX = w, maxX = -1;
    let minY = h, maxY = -1;
    let minZ = l, maxZ = -1;

    for (let y = 0; y < h; y++) {
      const yOff = y * w * l;
      for (let z = 0; z < l; z++) {
        const zOff = z * w + yOff;
        for (let x = 0; x < w; x++) {
          if (solidPal[blocks[x + zOff]]) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
        }
      }
    }

    if (maxX > minX && maxY > minY && maxZ > minZ) {
      const strideZ  = w;
      const strideY  = w * l;
      const totalY   = maxY - minY - 1;
      const yieldEvery = Math.max(1, Math.floor(totalY / 20));

      for (let y = minY + 1; y < maxY; y++) {
        const sliceIdx = y - minY - 1;

        if (sliceIdx % yieldEvery === 0) {
          const pct = Math.round((sliceIdx / Math.max(1, totalY)) * 100);
          report(pct);
          await YIELD();
        }

        const yOff = y * strideY;
        for (let z = minZ + 1; z < maxZ; z++) {
          let i = (minX + 1) + z * strideZ + yOff;
          for (let x = minX + 1; x < maxX; x++, i++) {
            if (!solidPal[blocks[i]])            continue;
            if (!solidPal[blocks[i + 1]])        continue;
            if (!solidPal[blocks[i - 1]])        continue;
            if (!solidPal[blocks[i + strideZ]])  continue;
            if (!solidPal[blocks[i - strideZ]])  continue;
            if (!solidPal[blocks[i + strideY]])  continue;
            if (!solidPal[blocks[i - strideY]])  continue;
            hollowMask[i] = 1;
          }
        }
      }
    }

    report(100);
    await YIELD();
  } else {
    const strideZ    = w;
    const strideY    = w * l;
    const yieldEvery = Math.max(1, Math.floor(volume / 20));

    for (let i = 0; i < volume; i++) {
      if (i % yieldEvery === 0) {
        const pct = Math.round((i / volume) * 100);
        report(pct);
        await YIELD();
      }

      const k = baseGetKeyAt(i);
      if (!isSolidBlock(k)) continue;

      const x  = i % w;
      const yz = (i / w) | 0;
      const z  = yz % l;
      const y  = (yz / l) | 0;

      if (x <= 0 || y <= 0 || z <= 0 || x >= w - 1 || y >= h - 1 || z >= l - 1) continue;

      if (!isSolidBlock(baseGetKeyAt(i + 1)))        continue;
      if (!isSolidBlock(baseGetKeyAt(i - 1)))        continue;
      if (!isSolidBlock(baseGetKeyAt(i + strideZ)))  continue;
      if (!isSolidBlock(baseGetKeyAt(i - strideZ)))  continue;
      if (!isSolidBlock(baseGetKeyAt(i + strideY)))  continue;
      if (!isSolidBlock(baseGetKeyAt(i - strideY)))  continue;
      hollowMask[i] = 1;
    }

    report(100);
    await YIELD();
  }

  return i => (hollowMask[i] ? null : baseGetKeyAt(i));
}

export {
  NON_SOLID_BLOCKS,
  stripState,
  isSolidBlock,
  hollowOutSchematic
};
