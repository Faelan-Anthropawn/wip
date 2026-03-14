import { generateCommands } from '../outputs/command-writer.js';
import { convertCommandsToStructure, createNbtBuffer } from '../outputs/structure-converter.js';
import { buildMcpack } from '../outputs/pack.js';

class CommandSink {
  constructor() {
    this.denseBlocks = null;
    this.palette = new Map();
    this.paletteIndex = 0;
    this.metadata = null;
  }

  async process(blockStream, onProgress) {
    return new Promise((resolve, reject) => {
      blockStream
        .onMetadata(metadata => {
          this.metadata = metadata;
          this.palette.set('minecraft:air', this.paletteIndex++);
          const vol = metadata.width * metadata.height * metadata.length;
          this.denseBlocks = new Uint32Array(vol);
        })
        .onBlock((x, y, z, blockState) => {
          if (blockState !== 'minecraft:air') {
            if (!this.palette.has(blockState)) {
              this.palette.set(blockState, this.paletteIndex++);
            }
            const idx = x + z * this.metadata.width + y * this.metadata.width * this.metadata.length;
            this.denseBlocks[idx] = this.palette.get(blockState);
          }
        })
        .onComplete(() => {
          try {
            const paletteArray = Array.from(this.palette.entries())
              .sort((a, b) => a[1] - b[1])
              .map(([name]) => name);
            
            const { width, height, length } = this.metadata;
            const wl = width * length;
            const schem = { width, height, length, type: 'modern' };
            
            const getKeyAt = (i) => {
              const v = this.denseBlocks[i];
              if (!v) return null;
              return paletteArray[v] || null;
            };
            
            if (onProgress) {
              onProgress({ stage: 'Generating', message: 'Creating commands...' });
            }
            
            const commands = generateCommands(schem, getKeyAt, { useRelativeCoords: true });
            const text = commands.join('\n');
            const blob = new Blob([text], { type: 'text/plain' });
            
            resolve({ blob, commands });
          } catch (error) {
            reject(error);
          }
        })
        .onError(reject);
    });
  }
}

class StructureSink {
  constructor() {
    this.denseBlocks = null;
    this.palette = new Map();
    this.paletteIndex = 0;
    this.metadata = null;
  }

  async process(blockStream, onProgress) {
    return new Promise((resolve, reject) => {
      blockStream
        .onMetadata(metadata => {
          this.metadata = metadata;
          this.palette.set('minecraft:air', this.paletteIndex++);
          
          if (metadata.width > 250 || metadata.length > 250) {
            reject(new Error(`Schematic too large for McStructure (${metadata.width}x${metadata.length}). Maximum is 250x250. Use Build Pack instead.`));
            return;
          }
          const vol = metadata.width * metadata.height * metadata.length;
          this.denseBlocks = new Uint32Array(vol);
        })
        .onBlock((x, y, z, blockState) => {
          if (blockState !== 'minecraft:air') {
            if (!this.palette.has(blockState)) {
              this.palette.set(blockState, this.paletteIndex++);
            }
            const idx = x + z * this.metadata.width + y * this.metadata.width * this.metadata.length;
            this.denseBlocks[idx] = this.palette.get(blockState);
          }
        })
        .onComplete(() => {
          try {
            const paletteArray = Array.from(this.palette.entries())
              .sort((a, b) => a[1] - b[1])
              .map(([name]) => name);
            
            const { width, height, length } = this.metadata;
            const schem = { width, height, length, type: 'modern' };
            
            const getKeyAt = (i) => {
              const v = this.denseBlocks[i];
              if (!v) return null;
              return paletteArray[v] || null;
            };
            
            if (onProgress) {
              onProgress({ stage: 'Generating', message: 'Creating commands...' });
            }
            
            const commands = generateCommands(schem, getKeyAt, { useRelativeCoords: true });
            
            if (onProgress) {
              onProgress({ stage: 'Converting', message: 'Creating mcstructure...' });
            }
            
            const structureData = convertCommandsToStructure(commands, {
              width,
              height,
              length,
              baseCoords: [0, 0, 0]
            });
            
            const nbtBuffer = createNbtBuffer(structureData);
            const blob = new Blob([nbtBuffer], { type: 'application/octet-stream' });
            
            resolve({ blob, commands });
          } catch (error) {
            reject(error);
          }
        })
        .onError(reject);
    });
  }
}

class PackSink {
  constructor() {
    this.denseBlocks = null;
    this.palette = new Map();
    this.paletteIndex = 0;
    this.metadata = null;
  }

  async process(blockStream, onProgress) {
    return new Promise((resolve, reject) => {
      blockStream
        .onMetadata(metadata => {
          this.metadata = metadata;
          this.palette.set('minecraft:air', this.paletteIndex++);
          const vol = metadata.width * metadata.height * metadata.length;
          this.denseBlocks = new Uint32Array(vol);
        })
        .onBlock((x, y, z, blockState) => {
          if (blockState !== 'minecraft:air') {
            if (!this.palette.has(blockState)) {
              this.palette.set(blockState, this.paletteIndex++);
            }
            const idx = x + z * this.metadata.width + y * this.metadata.width * this.metadata.length;
            this.denseBlocks[idx] = this.palette.get(blockState);
          }
        })
        .onComplete(async () => {
          try {
            const paletteArray = Array.from(this.palette.entries())
              .sort((a, b) => a[1] - b[1])
              .map(([name]) => name);
            
            const { width, height, length } = this.metadata;
            const schem = { width, height, length, type: 'modern' };
            
            const getKeyAt = (i) => {
              const v = this.denseBlocks[i];
              if (!v) return null;
              return paletteArray[v] || null;
            };
            
            const blob = await buildMcpack(schem, getKeyAt, 'world_export', onProgress);
            resolve({ blob });
          } catch (error) {
            reject(error);
          }
        })
        .onError(reject);
    });
  }
}

export { CommandSink, StructureSink, PackSink };
