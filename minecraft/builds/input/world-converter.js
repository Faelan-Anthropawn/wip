import { loadWorldRegions, readWorldVersion, createBlockStreamFromWorld } from './world-reader.js';
import { loadSchematicFromStream } from './schematic-reader.js';
import { loadTranslationData, makeMergeKeyGetter, updateActiveReplacements, isValidBlockId } from '../translation/translation.js';
import { hollowOutSchematic } from '../edits/hollowing.js';
import { applyRotation } from '../edits/rotation.js';
import { applyMirroring } from '../edits/mirroring.js';
import { addStructureVoidSupport } from '../edits/structure-void.js';
import { generateCommands } from '../outputs/command-writer.js';
import { createNbtBuffer, convertCommandsToStructure } from '../outputs/structure-converter.js';
import { buildMcpack } from '../outputs/pack.js';

let worldFile = null;
let mcaFiles = null;
let lastVersionInfo = null;

const dropZone = document.getElementById('world-drop-zone');
const browseButton = document.getElementById('world-browse-button');
const fileInput = document.getElementById('world-file-input');
const fileNameDisplay = document.getElementById('world-file-name');

const x1Input = document.getElementById('world-x1');
const y1Input = document.getElementById('world-y1');
const z1Input = document.getElementById('world-z1');
const x2Input = document.getElementById('world-x2');
const y2Input = document.getElementById('world-y2');
const z2Input = document.getElementById('world-z2');
const outputNameInput = document.getElementById('world-output-name');
const outputFormatSelect = document.getElementById('world-output-format');
const hollowToggle = document.getElementById('world-hollow-toggle');
const structureVoidToggle = document.getElementById('world-structure-void-toggle');
const includeAirToggle = document.getElementById('world-include-air-toggle');
const rotationSelect = document.getElementById('world-rotation-select');
const mirrorXBtn = document.getElementById('world-mirror-x');
const mirrorYBtn = document.getElementById('world-mirror-y');
const mirrorZBtn = document.getElementById('world-mirror-z');
const dimensionSelect = document.getElementById('world-dimension-select');
const convertButton = document.getElementById('world-convert-button');
const statusMessage = document.getElementById('world-status-message');
const consoleBox = document.getElementById('world-console-box');

const addReplacementBtn = document.getElementById('world-add-replacement');
const replacementList = document.getElementById('world-replacement-list');

const worldInfoPanel = document.getElementById('world-info-panel');
const worldInfoIcon = document.getElementById('world-info-icon');
const worldInfoTitle = document.getElementById('world-info-title');
const worldInfoDesc = document.getElementById('world-info-desc');

function setWorldInfoPanel(state, { title = '', desc = '' } = {}) {
  if (!worldInfoPanel) return;
  const panel = worldInfoPanel;
  const icon = worldInfoIcon;
  const titleEl = worldInfoTitle;
  const descEl = worldInfoDesc;

  titleEl.style.opacity = '1';
  titleEl.style.color = '';

  if (state === 'idle') {
    panel.style.borderColor = 'rgba(138, 168, 168, 0.15)';
    panel.style.backgroundColor = 'rgba(138, 168, 168, 0.04)';
    icon.textContent = 'public';
    icon.style.color = 'var(--mist)';
    icon.style.opacity = '0.4';
    titleEl.textContent = 'No world loaded';
    titleEl.style.color = 'var(--mist)';
    titleEl.style.opacity = '0.5';
    descEl.textContent = 'Select a file above to continue';
    descEl.style.color = '';
  } else if (state === 'loading') {
    panel.style.borderColor = 'rgba(138, 168, 168, 0.2)';
    panel.style.backgroundColor = 'rgba(138, 168, 168, 0.06)';
    icon.textContent = 'hourglass_empty';
    icon.style.color = 'var(--mist)';
    icon.style.opacity = '0.7';
    titleEl.textContent = title || 'Loading world...';
    titleEl.style.color = 'var(--mist)';
    titleEl.style.opacity = '0.8';
    descEl.textContent = desc || 'Reading region files';
    descEl.style.color = '';
  } else if (state === 'ready') {
    panel.style.borderColor = 'rgba(34, 197, 94, 0.3)';
    panel.style.backgroundColor = 'rgba(34, 197, 94, 0.05)';
    icon.textContent = 'check_circle';
    icon.style.color = '#22c55e';
    icon.style.opacity = '1';
    titleEl.textContent = title || 'World ready';
    titleEl.style.color = '#22c55e';
    titleEl.style.opacity = '1';
    descEl.textContent = desc || '';
    descEl.style.color = '';
  } else if (state === 'warning') {
    panel.style.borderColor = 'rgba(234, 179, 8, 0.35)';
    panel.style.backgroundColor = 'rgba(234, 179, 8, 0.05)';
    icon.textContent = 'warning';
    icon.style.color = '#eab308';
    icon.style.opacity = '1';
    titleEl.textContent = title || 'World ready (with warning)';
    titleEl.style.color = '#eab308';
    titleEl.style.opacity = '1';
    descEl.textContent = desc || '';
    descEl.style.color = '#ca8a04';
  } else if (state === 'error') {
    panel.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    panel.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
    icon.textContent = 'error';
    icon.style.color = 'var(--ember)';
    icon.style.opacity = '1';
    titleEl.textContent = title || 'Error loading world';
    titleEl.style.color = 'var(--ember)';
    titleEl.style.opacity = '1';
    descEl.textContent = desc || '';
    descEl.style.color = '';
  }
}

function createReplacementRow() {
  const row = document.createElement('div');
  row.className = 'flex gap-2 items-center';
  row.innerHTML = `
    <input type="text" placeholder="Original" class="replacement-original input-field flex-1 h-9 px-3 rounded-lg text-sm text-white" style="background-color: var(--void); border-color: rgba(138, 168, 168, 0.2);">
    <span class="material-symbols-outlined text-slate-500 text-sm">arrow_forward</span>
    <input type="text" placeholder="Replace" class="replacement-target input-field flex-1 h-9 px-3 rounded-lg text-sm text-white" style="background-color: var(--void); border-color: rgba(138, 168, 168, 0.2);">
    <button type="button" class="remove-replacement p-1 text-slate-500 hover:text-red-400 transition-colors">
      <span class="material-symbols-outlined text-sm">close</span>
    </button>
  `;
  
  row.querySelector('.remove-replacement').addEventListener('click', () => row.remove());
  return row;
}

if (addReplacementBtn) {
  addReplacementBtn.addEventListener('click', () => {
    replacementList.appendChild(createReplacementRow());
  });
}

function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
}

function logToConsole(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'console-entry';
  
  const timestamp = document.createElement('span');
  timestamp.className = 'console-timestamp';
  timestamp.textContent = `[${getTimestamp()}]`;
  
  const text = document.createElement('span');
  text.textContent = message;
  
  if (type === 'error') {
    text.style.color = 'var(--ember)';
  } else if (type === 'success') {
    text.style.color = '#22c55e';
  } else if (type === 'info') {
    text.style.color = 'var(--mist)';
  }
  
  entry.appendChild(timestamp);
  entry.appendChild(text);
  consoleBox.appendChild(entry);
  const _entries = consoleBox.querySelectorAll('.console-entry');
  if (_entries.length > 20) _entries[0].remove();
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function clearConsole() {
  consoleBox.innerHTML = '';
}

function worldShowStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = type;
}

async function handleFileSelect(file) {
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.zip')) {
    worldShowStatus('Please select a .zip file containing Minecraft world data', 'error');
    logToConsole('Error: Invalid file type. Please select a .zip file', 'error');
    setWorldInfoPanel('error', { title: 'Invalid file type', desc: 'Please select a .zip file containing Minecraft world data.' });
    return;
  }

  worldFile = file;
  fileNameDisplay.textContent = file.name;
  worldShowStatus(`Loading world file: ${file.name}`, 'info');
  logToConsole(`Loading world file: ${file.name}`, 'info');
  setWorldInfoPanel('loading', { title: 'Loading world...', desc: file.name });

  try {
    const dimension = dimensionSelect ? dimensionSelect.value : 'overworld';
    const dimLabel = dimensionSelect ? dimensionSelect.options[dimensionSelect.selectedIndex].text : 'Overworld';

    const [regions, versionInfo] = await Promise.all([
      loadWorldRegions(file, dimension),
      readWorldVersion(file)
    ]);

    mcaFiles = regions;
    lastVersionInfo = versionInfo;
    const regionCount = Object.keys(mcaFiles).length;

    const versionStr = versionInfo.versionName ? ` (Java ${versionInfo.versionName})` : '';
    logToConsole(`World loaded successfully! Found ${regionCount} ${dimLabel} region file(s)${versionStr}`, 'success');
    if (versionInfo.versionId) logToConsole(`Data version: ${versionInfo.versionId}`, 'info');

    if (versionInfo.isOld) {
      const warnMsg = 'The selected world is older than the supported versions. You may still process the file however it will likely not work.';
      worldShowStatus(`World loaded with warning — ${regionCount} region file(s)`, 'info');
      logToConsole(`Warning: ${warnMsg}`, 'error');
      setWorldInfoPanel('warning', {
        title: `World loaded — ${regionCount} ${dimLabel} region file(s)${versionStr}`,
        desc: warnMsg
      });
    } else {
      worldShowStatus(`World loaded! Found ${regionCount} ${dimLabel} region file(s)`, 'success');
      setWorldInfoPanel('ready', {
        title: `World ready — ${regionCount} ${dimLabel} region file(s)`,
        desc: versionInfo.versionName ? `Java Edition ${versionInfo.versionName}` : 'Version unknown — enter coordinates and begin conversion'
      });
    }
  } catch (error) {
    if (error.message === 'OLD_WORLD_FORMAT') {
      worldShowStatus('World file is too old to process', 'error');
      logToConsole('Error: World contains .mcr files (pre-1.2.2 format)', 'error');
      setWorldInfoPanel('error', {
        title: 'World too old to process',
        desc: 'This world uses the pre-1.2.2 .mcr format. Try updating it with chunker or je2be first.'
      });
    } else {
      worldShowStatus('Error loading world file: ' + error.message, 'error');
      logToConsole('Error loading world: ' + error.message, 'error');
      setWorldInfoPanel('error', { title: 'Error loading world', desc: error.message });
    }
    worldFile = null;
    mcaFiles = null;
  }
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

dropZone.addEventListener('click', () => {
  fileInput.click();
});

browseButton.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

if (dimensionSelect) {
  dimensionSelect.addEventListener('change', async () => {
    if (!worldFile) return;
    const dimension = dimensionSelect.value;
    const dimLabel = dimensionSelect.options[dimensionSelect.selectedIndex].text;
    worldShowStatus(`Reloading regions for ${dimLabel}...`, 'info');
    logToConsole(`Switching to ${dimLabel}...`, 'info');
    setWorldInfoPanel('loading', { title: `Switching to ${dimLabel}...`, desc: worldFile.name });
    try {
      mcaFiles = await loadWorldRegions(worldFile, dimension);
      const regionCount = Object.keys(mcaFiles).length;
      worldShowStatus(`${dimLabel}: Found ${regionCount} region file(s)`, 'success');
      logToConsole(`${dimLabel}: Found ${regionCount} region file(s)`, 'success');
      const vi = lastVersionInfo;
      const vStr = vi?.versionName ? ` (Java ${vi.versionName})` : '';
      if (vi?.isOld) {
        setWorldInfoPanel('warning', {
          title: `World loaded — ${regionCount} ${dimLabel} region file(s)${vStr}`,
          desc: 'The selected world is older than the supported versions. You may still process the file however it will likely not work.'
        });
      } else {
        setWorldInfoPanel('ready', {
          title: `World ready — ${regionCount} ${dimLabel} region file(s)`,
          desc: vi?.versionName ? `Java Edition ${vi.versionName}` : 'Enter coordinates and begin conversion'
        });
      }
    } catch (error) {
      worldShowStatus('Error reloading dimension: ' + error.message, 'error');
      logToConsole('Error reloading dimension: ' + error.message, 'error');
      setWorldInfoPanel('error', { title: 'Error switching dimension', desc: error.message });
      mcaFiles = null;
    }
  });
}

[mirrorXBtn, mirrorYBtn, mirrorZBtn].forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
  });
});

const worldHelpButton = document.getElementById('world-help-button');

function openWorldHelpModal() {
  const modal = document.getElementById('help-modal');
  const content = document.getElementById('help-modal-content');
  
content.innerHTML = `
  <h3 class="text-xl font-bold text-white mb-2">Output Formats</h3>
  <ul class="list-disc list-inside mb-4 leading-tight">
    <li><strong class="text-white">Build Pack</strong> — Structure-based build loading using an in-game GUI recommended for larger builds</li>
    <li><strong class="text-white">McStructure</strong> — Creates a single .mcstructure file (max 250×250) — recommended for smaller builds</li>
    <li><strong class="text-white">Command Dump</strong> — Exports a .txt file with fill/setblock commands — recommended for other tools</li>
  </ul>

  <h3 class="text-xl font-bold text-white mb-2">Build Edits</h3>
  <ul class="list-disc list-inside mb-4 leading-tight">
    <li><strong class="text-white">Hollow Build</strong> — Removes interior blocks, keeping only the outer shell for faster loading.</li>
    <li><strong class="text-white">No Falling Blocks</strong> — Adds barriers under gravity-affected blocks to prevent falling if there is air below it.</li>
  </ul>

  <h3 class="text-xl font-bold text-white mb-2">Transformations</h3>
  <ul class="list-disc list-inside mb-4 leading-tight">
    <li><strong class="text-white">Rotation</strong> — Rotate the schematic 0°, 90°, 180°, or 270° clockwise.</li>
    <li><strong class="text-white">Mirror</strong> — Mirror across X, Y, or Z axes (combinations supported).</li>
  </ul>

  <h3 class="text-xl font-bold text-white mb-2">PSA</h3>
  <p class="leading-snug">All processing is done client-side in your browser, so processing times may vary.</p>
  <p class="mt-1 leading-snug">For XL regions, the site may become unresponsive — click “Wait” a few times and it should finish.</p>
  <p class="mt-1 leading-snug">Requires a java world in anvil format (V 1.18 or higher).</p>
`;

modal.classList.remove('hidden');
modal.classList.add('flex');
document.body.style.overflow = 'hidden';
}

worldHelpButton.addEventListener('click', openWorldHelpModal);

function normalizeBlockId(id) {
  if (!id) return '';
  let normalized = id.toLowerCase().trim().replace(/\s+/g, '_');
  if (!normalized.includes(':')) {
    normalized = 'minecraft:' + normalized;
  }
  return normalized;
}

function getReplacements() {
  const replacements = {};
  let errors = [];
  document.querySelectorAll('#world-replacement-list .flex').forEach(row => {
    const original = normalizeBlockId(row.querySelector('.replacement-original').value);
    const target = normalizeBlockId(row.querySelector('.replacement-target').value);
    if (original && target && original !== 'minecraft:' && target !== 'minecraft:') {
      if (!isValidBlockId(target)) {
        errors.push(`Invalid replacement block ID: ${target}`);
      }
      replacements[original] = target;
    }
  });
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return replacements;
}

function flashInputError(...inputs) {
  inputs.forEach(el => {
    if (!el) return;
    el.style.borderColor = 'var(--ember)';
    setTimeout(() => { el.style.borderColor = ''; }, 2000);
  });
}

async function convertWorld() {
  if (!mcaFiles) {
    worldShowStatus('Load a world file before converting', 'error');
    logToConsole('Error: No world loaded — select a .zip file above', 'error');
    setWorldInfoPanel('idle');
    return;
  }

  const x1 = parseInt(x1Input.value.trim());
  const y1 = parseInt(y1Input.value.trim());
  const z1 = parseInt(z1Input.value.trim());
  const x2 = parseInt(x2Input.value.trim());
  const y2 = parseInt(y2Input.value.trim());
  const z2 = parseInt(z2Input.value.trim());

  const coordInputs = [x1Input, y1Input, z1Input, x2Input, y2Input, z2Input];
  const badInputs = coordInputs.filter((el, i) => isNaN([x1, y1, z1, x2, y2, z2][i]));

  if (badInputs.length > 0) {
    worldShowStatus('Enter valid coordinates for all 6 fields before converting', 'error');
    logToConsole('Error: Missing or invalid coordinates', 'error');
    flashInputError(...badInputs);
    return;
  }

  const width = Math.abs(x2 - x1) + 1;
  const height = Math.abs(y2 - y1) + 1;
  const length = Math.abs(z2 - z1) + 1;
  const totalBlocks = width * height * length;

  if (totalBlocks > 1000000) {
    logToConsole(`Large region: ${totalBlocks.toLocaleString()} blocks (${width}×${height}×${length}) — this may freeze the browser on weaker devices`, 'error');
    worldShowStatus(`Large region (${totalBlocks.toLocaleString()} blocks) — processing...`, 'info');
  }
  
  const outputName = outputNameInput.value.trim() || 'world_export';
  const outputFormat = outputFormatSelect.value.toLowerCase().replace(' ', '_');
  const hollow = hollowToggle.checked;
  const structureVoid = structureVoidToggle.checked;
  const includeAir = includeAirToggle.checked;
  const rotation = parseInt(rotationSelect.selectedIndex) * 90;
  const mirrorX = mirrorXBtn.classList.contains('active');
  const mirrorY = mirrorYBtn.classList.contains('active');
  const mirrorZ = mirrorZBtn.classList.contains('active');
  
  convertButton.disabled = true;
  
  try {
    const replacements_obj = getReplacements();
    updateActiveReplacements(replacements_obj);
    
    document.querySelector('.live-anim-box').classList.add('active');
    const liveBox = document.querySelector('.live-anim-box');
    const pingInterval = setInterval(() => {
      if (liveBox && liveBox.classList.contains('active')) {
        const icon = liveBox.querySelector('.spiral-icon');
        if (icon) {
          icon.style.opacity = (parseFloat(icon.style.opacity) || 1) === 0.8 ? '1' : '0.8';
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 500);

    convertButton.textContent = 'Converting...';
    clearConsole();
    logToConsole('=== Starting World Conversion Process ===', 'info');
    logToConsole(`Output format: ${outputFormat}`, 'info');
    logToConsole(`Output name: ${outputName}`, 'info');
    logToConsole(`Region: (${x1}, ${y1}, ${z1}) to (${x2}, ${y2}, ${z2})`, 'info');

    worldShowStatus('Loading translation data...', 'info');
    logToConsole('Loading translation data...', 'info');
    await loadTranslationData();
    logToConsole('Translation data loaded successfully', 'success');
    
    const progressCallback = async (progress) => {
      logToConsole(`${progress.stage}: ${progress.message}`, 'info');
      convertButton.textContent = `${progress.stage}...`;
      
      await new Promise(r => setTimeout(r, 0));
    };
    
    worldShowStatus('Creating block stream from world region...', 'info');
    convertButton.textContent = 'Streaming world data...';
    logToConsole('Creating block stream from world region...', 'info');
    
    const blockStream = await createBlockStreamFromWorld(
      mcaFiles, x1, y1, z1, x2, y2, z2, progressCallback
    );
    
    worldShowStatus('Loading schematic from stream...', 'info');
    convertButton.textContent = 'Processing blocks...';
    logToConsole('Loading schematic from stream...', 'info');
    
    const schem = await loadSchematicFromStream(blockStream);
    
    logToConsole(`World region loaded successfully`, 'success');
    logToConsole(`Dimensions: ${schem.width}x${schem.height}x${schem.length}`, 'info');
    worldShowStatus(`Region extracted: ${schem.width}x${schem.height}x${schem.length}`, 'success');
    
    let currentSchem = schem;
    
    if (rotation !== 0) {
      worldShowStatus(`Rotating ${rotation}°... 0%`, 'info');
      convertButton.textContent = `Rotating ${rotation}°... 0%`;
      logToConsole(`Applying rotation: ${rotation}°`, 'info');
      currentSchem = (await applyRotation(currentSchem, rotation, (pct) => {
        worldShowStatus(`Rotating ${rotation}°... ${pct}%`, 'info');
        convertButton.textContent = `Rotating ${rotation}°... ${pct}%`;
        logToConsole(`Rotating: ${pct}%`, 'info');
      })).rotatedSchem;
      logToConsole('Rotation applied successfully', 'success');
    }
    
    if (mirrorX || mirrorY || mirrorZ) {
      const axes = [];
      if (mirrorX) axes.push('X');
      if (mirrorY) axes.push('Y');
      if (mirrorZ) axes.push('Z');
      const axesLabel = axes.join(', ');
      worldShowStatus(`Mirroring across ${axesLabel}... 0%`, 'info');
      convertButton.textContent = `Mirroring... 0%`;
      logToConsole(`Applying mirror transformation: ${axesLabel} axis`, 'info');
      currentSchem = await applyMirroring(currentSchem, mirrorX, mirrorY, mirrorZ, (pct) => {
        worldShowStatus(`Mirroring across ${axesLabel}... ${pct}%`, 'info');
        convertButton.textContent = `Mirroring... ${pct}%`;
        logToConsole(`Mirroring: ${pct}%`, 'info');
      });
      logToConsole('Mirroring applied successfully', 'success');
    }

    let getKeyAt = makeMergeKeyGetter(currentSchem, replacements_obj, { includeAir: includeAir });
    
    if (hollow) {
      worldShowStatus('Hollowing out schematic... 0%', 'info');
      convertButton.textContent = 'Hollowing... 0%';
      logToConsole('Hollowing out schematic...', 'info');
      getKeyAt = await hollowOutSchematic(currentSchem, getKeyAt, (pct) => {
        worldShowStatus(`Hollowing out schematic... ${pct}%`, 'info');
        convertButton.textContent = `Hollowing... ${pct}%`;
        logToConsole(`Hollowing: ${pct}%`, 'info');
      });
      logToConsole('Hollowing completed', 'success');
    }
    
    if (structureVoid) {
      worldShowStatus('Scanning for falling blocks... 0%', 'info');
      convertButton.textContent = 'Scanning falling blocks... 0%';
      logToConsole('Scanning for falling blocks...', 'info');
      getKeyAt = await addStructureVoidSupport(currentSchem, getKeyAt, (pct) => {
        worldShowStatus(`Scanning for falling blocks... ${pct}%`, 'info');
        convertButton.textContent = `Scanning falling blocks... ${pct}%`;
        logToConsole(`Falling block scan: ${pct}%`, 'info');
      });
      logToConsole('Barrier support added', 'success');
    }
    
    if (outputFormat === 'command_dump') {
      worldShowStatus('Generating commands...', 'info');
      convertButton.textContent = 'Generating commands...';
      logToConsole('Generating commands...', 'info');
      const commands = generateCommands(currentSchem, getKeyAt, { useRelativeCoords: true, includeAir: includeAir });
      logToConsole(`Generated ${commands.length} commands`, 'success');
      
      logToConsole('Creating text file...', 'info');
      const text = commands.join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      downloadBlob(blob, `${outputName}.txt`);
      
      worldShowStatus(`✅ Success! Generated ${commands.length} commands`, 'success');
      logToConsole(`File downloaded: ${outputName}.txt`, 'success');
      logToConsole('=== Conversion Complete ===', 'success');

    } else if (outputFormat === 'mcstructure') {
      if (currentSchem.width > 250 || currentSchem.length > 250) {
        worldShowStatus(`Schematic too large for McStructure (${currentSchem.width}×${currentSchem.length} — max 250×250). Use Build Pack instead.`, 'error');
        logToConsole(`Error: Schematic dimensions (${currentSchem.width}×${currentSchem.length}) exceed McStructure limit (250×250)`, 'error');
        convertButton.disabled = false;
        convertButton.textContent = 'Begin Conversion';
        return;
      }

      worldShowStatus('Generating commands for structure...', 'info');
      convertButton.textContent = 'Generating structure...';
      logToConsole('Generating commands for structure...', 'info');
      const commands = generateCommands(currentSchem, getKeyAt, { useRelativeCoords: true, includeAir: includeAir });

      if (commands.length === 0) {
        worldShowStatus('No commands generated — the selected region may be empty', 'error');
        logToConsole('Error: No commands generated — structure is empty', 'error');
        convertButton.disabled = false;
        convertButton.textContent = 'Begin Conversion';
        return;
      }

      logToConsole(`Generated ${commands.length} commands`, 'success');
      worldShowStatus(`Creating .mcstructure (${currentSchem.width}×${currentSchem.height}×${currentSchem.length})...`, 'info');
      convertButton.textContent = 'Creating .mcstructure...';
      logToConsole(`Creating .mcstructure (${currentSchem.width}×${currentSchem.height}×${currentSchem.length})...`, 'info');
      const structureData = convertCommandsToStructure(commands, {
        width: currentSchem.width,
        height: currentSchem.height,
        length: currentSchem.length,
        baseCoords: [0, 0, 0]
      });

      if (!structureData) {
        worldShowStatus('Failed to convert commands to structure data', 'error');
        logToConsole('Error: Failed to convert commands to structure data', 'error');
        convertButton.disabled = false;
        convertButton.textContent = 'Begin Conversion';
        return;
      }

      logToConsole('Converting to NBT format...', 'info');
      const nbtBuffer = createNbtBuffer(structureData);
      const blob = new Blob([nbtBuffer], { type: 'application/octet-stream' });
      downloadBlob(blob, `${outputName}.mcstructure`);

      worldShowStatus(`✅ Success! Created .mcstructure with ${commands.length} commands`, 'success');
      logToConsole(`File downloaded: ${outputName}.mcstructure`, 'success');
      logToConsole('=== Conversion Complete ===', 'success');

    } else {
      worldShowStatus('Building mcpack...', 'info');
      convertButton.textContent = 'Building mcpack...';
      logToConsole('Building mcpack...', 'info');
      const blob = await buildMcpack(currentSchem, getKeyAt, outputName, (progress) => {
        worldShowStatus(`${progress.stage}: ${progress.message}`, 'info');
        logToConsole(`${progress.stage}: ${progress.message}`, 'info');
      });

      downloadBlob(blob, `${outputName}.mcpack`);

      worldShowStatus(`✅ Success! Build pack created!`, 'success');
      logToConsole(`File downloaded: ${outputName}.mcpack`, 'success');
      logToConsole('=== Conversion Complete ===', 'success');
    }

  } catch (error) {
    worldShowStatus('❌ Error: ' + error.message, 'error');
    logToConsole('❌ Error: ' + error.message, 'error');
    logToConsole('=== Conversion Failed ===', 'error');
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = 'Begin Conversion';
    document.querySelector('.live-anim-box').classList.remove('active');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.click();
  URL.revokeObjectURL(url);
}

if (convertButton) {
  convertButton.addEventListener('click', convertWorld);
}

logToConsole('World Converter initialized', 'success');
loadTranslationData().then(() => {
  logToConsole('Translation data loaded', 'success');
}).catch((error) => {
  logToConsole('Error loading translation data: ' + error.message, 'error');
});

window.buildTabCleanup = (function() {
  const originalCleanup = window.buildTabCleanup || function() {};
  return function() {
    originalCleanup();
    worldFile = null;
    mcaFiles = null;
    lastVersionInfo = null;
    fileNameDisplay.textContent = '';
    fileInput.value = '';
    clearConsole();
    setWorldInfoPanel('idle');
  };
})();
