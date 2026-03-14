const YIELD = () => new Promise(r => setTimeout(r, 0));

function normalizeRotation(angle) {
  const numAngle = Number(angle);
  if (numAngle === 360) return 0;
  if (![0, 90, 180, 270].includes(numAngle)) {
    throw new Error(`Invalid rotation angle: ${angle}. Must be 0, 90, 180, 270, or 360.`);
  }
  return numAngle;
}

function rotateCoordinates(x, z, angle, originalWidth, originalLength) {
  switch (angle) {
    case 0:   return [x, z];
    case 90:  return [z, originalWidth - 1 - x];
    case 180: return [originalWidth - 1 - x, originalLength - 1 - z];
    case 270: return [originalLength - 1 - z, x];
    default:  throw new Error(`Unsupported rotation angle: ${angle}`);
  }
}

function getRotatedDimensions(width, height, length, angle) {
  switch (angle) {
    case 0:
    case 180: return { width, height, length };
    case 90:
    case 270: return { width: length, height, length: width };
    default:  throw new Error(`Unsupported rotation angle: ${angle}`);
  }
}

async function applyRotation(schem, rotationAngle, onProgress) {
  const angle = normalizeRotation(rotationAngle);
  if (angle === 0) return { rotatedSchem: schem };

  const report = typeof onProgress === 'function' ? onProgress : () => {};
  const { width: ow, height: h, length: ol } = schem;
  const { width: rw, length: rl } = getRotatedDimensions(ow, h, ol, angle);
  const inverseAngle = (360 - angle) % 360;
  const yieldEvery = Math.max(1, Math.floor(h / 20));

  if (schem.blocks instanceof Uint32Array) {
    const origBlocks    = schem.blocks;
    const rotatedBlocks = new Uint32Array(rw * h * rl);

    for (let ry = 0; ry < h; ry++) {
      if (ry % yieldEvery === 0) {
        report(Math.round((ry / h) * 100));
        await YIELD();
      }
      const yOffOrig = ry * ow * ol;
      const yOffRot  = ry * rw * rl;
      for (let rz = 0; rz < rl; rz++) {
        for (let rx = 0; rx < rw; rx++) {
          const [ox, oz] = rotateCoordinates(rx, rz, inverseAngle, rw, rl);
          rotatedBlocks[rx + rz * rw + yOffRot] = origBlocks[ox + oz * ow + yOffOrig];
        }
      }
    }

    report(100);
    await YIELD();
    return { rotatedSchem: { ...schem, width: rw, height: h, length: rl, blocks: rotatedBlocks } };
  }

  if (schem.legacyBlocks) {
    const origBlocks    = schem.legacyBlocks;
    const origData      = schem.legacyData;
    const rotatedBlocks = origBlocks instanceof Uint16Array
      ? new Uint16Array(rw * h * rl) : new Uint8Array(rw * h * rl);
    const rotatedData   = origData ? new Uint8Array(rw * h * rl) : null;

    for (let ry = 0; ry < h; ry++) {
      if (ry % yieldEvery === 0) {
        report(Math.round((ry / h) * 100));
        await YIELD();
      }
      const yOffOrig = ry * ow * ol;
      const yOffRot  = ry * rw * rl;
      for (let rz = 0; rz < rl; rz++) {
        for (let rx = 0; rx < rw; rx++) {
          const [ox, oz]  = rotateCoordinates(rx, rz, inverseAngle, rw, rl);
          const rotIdx    = rx + rz * rw + yOffRot;
          const origIdx   = ox + oz * ow + yOffOrig;
          rotatedBlocks[rotIdx] = origBlocks[origIdx];
          if (rotatedData) rotatedData[rotIdx] = origData[origIdx];
        }
      }
    }

    report(100);
    await YIELD();
    return {
      rotatedSchem: { ...schem, width: rw, height: h, length: rl,
        legacyBlocks: rotatedBlocks, legacyData: rotatedData }
    };
  }

  report(100);
  return { rotatedSchem: { ...schem, width: rw, height: h, length: rl } };
}

export {
  normalizeRotation,
  rotateCoordinates,
  getRotatedDimensions,
  applyRotation
};
