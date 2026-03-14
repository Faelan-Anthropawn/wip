const GRAVITY_BLOCKS = new Set([
  "minecraft:sand", "minecraft:red_sand", "minecraft:gravel", "minecraft:scaffolding", "minecraft:suspicous_sand", "minecraft:suspicous_gravel", "minecraft:anvil", "minecraft:chipped_anvil", "minecraft:damaged_anvil", "minecraft:black_concrete_powder", "minecraft:blue_concrete_powder", "minecraft:cyan_concrete_powder", "minecraft:gray_concrete_powder", "minecraft:green_concrete_powder", "minecraft:light_blue_concrete_powder", "minecraft:light_gray_concrete_powder", "minecraft:lime_concrete_powder", "minecraft:magenta_concrete_powder", "minecraft:orange_concrete_powder", "minecraft:pink_concrete_powder", "minecraft:purple_concrete_powder", "minecraft:red_concrete_powder", "minecraft:white_concrete_powder", "minecraft:yellow_concrete_powder", "minecraft:brown_concrete_powder",
]);

function stripState(name) {
  return name ? name.split("[")[0] : "";
}

function isGravityBlock(name) {
  if (!name) return false;
  return GRAVITY_BLOCKS.has(stripState(name));
}

function isAirBlock(name) {
  if (!name) return true;
  const base = stripState(name);
  return base === "air" || base === "minecraft:air" || base === "";
}

const YIELD = () => new Promise(r => setTimeout(r, 0));

async function addStructureVoidSupport(schem, baseGetKeyAt, onProgress) {
  const report = typeof onProgress === 'function' ? onProgress : () => {};
  const { width: w, height: h, length: l } = schem;
  const volume   = w * h * l;
  const strideY  = w * l;
  const yieldEvery = Math.max(1, Math.floor(volume / 20));

  const blocks     = schem.blocks;
  const paletteStr = schem.paletteStr;

  if (blocks instanceof Uint32Array && paletteStr && paletteStr.length > 0) {
    const palLen = paletteStr.length;

    const gravityPal = new Uint8Array(palLen);
    const airPal     = new Uint8Array(palLen);
    for (let p = 0; p < palLen; p++) {
      const name = paletteStr[p];
      gravityPal[p] = isGravityBlock(name) ? 1 : 0;
      airPal[p]     = isAirBlock(name)     ? 1 : 0;
    }

    const barrierSet    = new Set();
    const belowBoundsXZ = new Set();
    const belowBoundsBarriers = [];

    for (let i = 0; i < volume; i++) {
      if (i % yieldEvery === 0) {
        const pct = Math.round((i / volume) * 100);
        report(pct);
        await YIELD();
      }

      if (!gravityPal[blocks[i]]) continue;

      const x  = i % w;
      const yz = (i / w) | 0;
      const z  = yz % l;
      const y  = (yz / l) | 0;

      if (y > 0) {
        const belowIdx = i - strideY;
        if (airPal[blocks[belowIdx]]) {
          barrierSet.add(belowIdx);
        }
      } else {
        const xzKey = x + z * 65536;
        if (!belowBoundsXZ.has(xzKey)) {
          belowBoundsXZ.add(xzKey);
          belowBoundsBarriers.push({ x, y: -1, z });
        }
      }
    }

    report(100);
    await YIELD();

    const getter = (i) => {
      if (barrierSet.has(i)) return "barrier";
      return baseGetKeyAt(i);
    };
    getter.belowBoundsBarriers = belowBoundsBarriers;
    return getter;
  }

  const structureVoidMap = new Map();
  const belowBoundsBarriers = [];
  const belowBoundsXZ = new Set();

  for (let i = 0; i < volume; i++) {
    if (i % yieldEvery === 0) {
      const pct = Math.round((i / volume) * 100);
      report(pct);
      await YIELD();
    }

    const blockName = baseGetKeyAt(i);
    if (!isGravityBlock(blockName)) continue;

    const x  = i % w;
    const yz = (i / w) | 0;
    const z  = yz % l;
    const y  = (yz / l) | 0;

    if (y > 0) {
      const belowIdx = i - strideY;
      if (isAirBlock(baseGetKeyAt(belowIdx))) {
        structureVoidMap.set(belowIdx, "barrier");
      }
    } else {
      const xzKey = x + z * 65536;
      if (!belowBoundsXZ.has(xzKey)) {
        belowBoundsXZ.add(xzKey);
        belowBoundsBarriers.push({ x, y: -1, z });
      }
    }
  }

  report(100);
  await YIELD();

  const getter = (i) => structureVoidMap.get(i) ?? baseGetKeyAt(i);
  getter.belowBoundsBarriers = belowBoundsBarriers;
  return getter;
}

export {
  GRAVITY_BLOCKS,
  stripState,
  isGravityBlock,
  isAirBlock,
  addStructureVoidSupport,
};
