import { generateCommands } from '../outputs/command-writer.js';
import { convertCommandsToStructure, createNbtBuffer } from '../outputs/structure-converter.js';
import { buildMcpack } from '../outputs/pack.js';

class CommandSink {
  constructor() {
    this.blockIndex = null;
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
          this.blockIndex = new Uint32Array(metadata.width * metadata.height * metadata.length);
        })
        .onBlock((x, y, z, blockState) => {
          if (blockState !== 'minecraft:air') {
            if (!this.palette.has(blockState)) {
              this.palette.set(blockState, this.paletteIndex++);
            }
            const idx = x + z * this.metadata.width + y * this.metadata.width * this.metadata.length;
            this.blockIndex[idx] = this.palette.get(blockState);
          }
        })
        .onComplete(() => {
          try {
            const paletteArray = Array.from(this.palette.entries())
              .sort((a, b) => a[1] - b[1])
              .map(([name]) => name);
            
            const schem = {
              width: this.metadata.width,
              height: this.metadata.height,
              length: this.metadata.length,
              blocks: this.blockIndex,
              palette: paletteArray,
              type: 'modern'
            };
            
            const w = this.metadata.width;
            const l = this.metadata.length;
            const blockIndex = this.blockIndex;
            const getKeyAt = (i) => paletteArray[blockIndex[i]] || 'minecraft:air';
            
            if (onProgress) {
              onProgress({ stage: 'Generating', message: 'Creating commands...' });
            }
            
            const commands = generateCommands(schem, getKeyAt, { useRelativeCoords: true, includeAir: options.includeAir || false });
            const text = commands.join('\n');
            const blob = new Blob([text], { type: 'text/plain' });
            
            resolve({ blob, commands });
          } catch (error) {
            reject(error);
          }
        });
    });
  }
}

class StructureSink {
  constructor() {
    this.blockIndex = null;
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

          this.blockIndex = new Uint32Array(metadata.width * metadata.height * metadata.length);
        })
        .onBlock((x, y, z, blockState) => {
          if (blockState !== 'minecraft:air') {
            if (!this.palette.has(blockState)) {
              this.palette.set(blockState, this.paletteIndex++);
            }
            const idx = x + z * this.metadata.width + y * this.metadata.width * this.metadata.length;
            this.blockIndex[idx] = this.palette.get(blockState);
          }
        })
        .onComplete(() => {
          try {
            const paletteArray = Array.from(this.palette.entries())
              .sort((a, b) => a[1] - b[1])
              .map(([name]) => name);
            
            const schem = {
              width: this.metadata.width,
              height: this.metadata.height,
              length: this.metadata.length,
              blocks: this.blockIndex,
              palette: paletteArray,
              type: 'modern'
            };
            
            const blockIndex = this.blockIndex;
            const getKeyAt = (i) => paletteArray[blockIndex[i]] || 'minecraft:air';
            
            if (onProgress) {
              onProgress({ stage: 'Generating', message: 'Creating commands...' });
            }
            
            const commands = generateCommands(schem, getKeyAt, { useRelativeCoords: true, includeAir: options.includeAir || false });
            
            if (onProgress) {
              onProgress({ stage: 'Converting', message: 'Creating mcstructure...' });
            }
            
            const structureData = convertCommandsToStructure(commands, {
              width: this.metadata.width,
              height: this.metadata.height,
              length: this.metadata.length,
              baseCoords: [0, 0, 0]
            });
            
            const nbtBuffer = createNbtBuffer(structureData);
            const blob = new Blob([nbtBuffer], { type: 'application/octet-stream' });
            
            resolve({ blob, commands });
          } catch (error) {
            reject(error);
          }
        });
    });
  }
}

class PackSink {
  constructor() {
    this.blockIndex = null;
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
          this.blockIndex = new Uint32Array(metadata.width * metadata.height * metadata.length);
        })
        .onBlock((x, y, z, blockState) => {
          if (blockState !== 'minecraft:air') {
            if (!this.palette.has(blockState)) {
              this.palette.set(blockState, this.paletteIndex++);
            }
            const idx = x + z * this.metadata.width + y * this.metadata.width * this.metadata.length;
            this.blockIndex[idx] = this.palette.get(blockState);
          }
        })
        .onComplete(async () => {
          try {
            const paletteArray = Array.from(this.palette.entries())
              .sort((a, b) => a[1] - b[1])
              .map(([name]) => name);
            
            const schem = {
              width: this.metadata.width,
              height: this.metadata.height,
              length: this.metadata.length,
              blocks: this.blockIndex,
              palette: paletteArray,
              type: 'modern'
            };
            
            const blockIndex = this.blockIndex;
            const getKeyAt = (i) => paletteArray[blockIndex[i]] || 'minecraft:air';
            
            const blob = await buildMcpack(schem, getKeyAt, 'world_export', onProgress);
            resolve({ blob });
          } catch (error) {
            reject(error);
          }
        });
    });
  }
}

export { CommandSink, StructureSink, PackSink };
