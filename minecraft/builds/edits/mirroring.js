const YIELD = () => new Promise(r => setTimeout(r, 0));

async function applyMirroring(schem, mirrorX, mirrorY, mirrorZ, onProgress) {
  if (!mirrorX && !mirrorY && !mirrorZ) return schem;

  const report = typeof onProgress === 'function' ? onProgress : () => {};
  const { width: w, height: h, length: l } = schem;
  const yieldEvery = Math.max(1, Math.floor(h / 20));

  if (schem.blocks instanceof Uint32Array) {
    const origBlocks    = schem.blocks;
    const mirroredBlocks = new Uint32Array(w * h * l);

    for (let y = 0; y < h; y++) {
      if (y % yieldEvery === 0) {
        report(Math.round((y / h) * 100));
        await YIELD();
      }
      const ny       = mirrorY ? h - 1 - y : y;
      const yOffSrc  = ny * w * l;
      const yOffDst  = y  * w * l;
      for (let z = 0; z < l; z++) {
        const nz      = mirrorZ ? l - 1 - z : z;
        const zOffSrc = nz * w + yOffSrc;
        const zOffDst = z  * w + yOffDst;
        for (let x = 0; x < w; x++) {
          const nx = mirrorX ? w - 1 - x : x;
          mirroredBlocks[x + zOffDst] = origBlocks[nx + zOffSrc];
        }
      }
    }

    report(100);
    await YIELD();
    return { ...schem, blocks: mirroredBlocks };
  }

  if (schem.legacyBlocks) {
    const origBlocks    = schem.legacyBlocks;
    const origData      = schem.legacyData;
    const mirroredBlocks = origBlocks instanceof Uint16Array
      ? new Uint16Array(w * h * l) : new Uint8Array(w * h * l);
    const mirroredData  = origData ? new Uint8Array(w * h * l) : null;

    for (let y = 0; y < h; y++) {
      if (y % yieldEvery === 0) {
        report(Math.round((y / h) * 100));
        await YIELD();
      }
      const ny       = mirrorY ? h - 1 - y : y;
      const yOffSrc  = ny * w * l;
      const yOffDst  = y  * w * l;
      for (let z = 0; z < l; z++) {
        const nz      = mirrorZ ? l - 1 - z : z;
        const zOffSrc = nz * w + yOffSrc;
        const zOffDst = z  * w + yOffDst;
        for (let x = 0; x < w; x++) {
          const nx  = mirrorX ? w - 1 - x : x;
          const dst = x  + zOffDst;
          const src = nx + zOffSrc;
          mirroredBlocks[dst] = origBlocks[src];
          if (mirroredData) mirroredData[dst] = origData[src];
        }
      }
    }

    report(100);
    await YIELD();
    return { ...schem, legacyBlocks: mirroredBlocks, legacyData: mirroredData };
  }

  report(100);
  return schem;
}

function mirrorCoordinates(x, y, z, mirrorX, mirrorY, mirrorZ, width, height, length) {
  return [
    mirrorX ? width  - 1 - x : x,
    mirrorY ? height - 1 - y : y,
    mirrorZ ? length - 1 - z : z,
  ];
}

export {
  mirrorCoordinates,
  applyMirroring
};
