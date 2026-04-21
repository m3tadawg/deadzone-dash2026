const fs = require('fs');
const path = require('path');

function loadDirectoryAsMap(dirPath, idField = 'id') {
  const entries = {};
  if (!fs.existsSync(dirPath)) return entries;

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
  files.forEach((fileName) => {
    const raw = JSON.parse(fs.readFileSync(path.join(dirPath, fileName), 'utf8'));
    const id = raw[idField] || fileName.replace(/\.json$/, '');
    entries[id] = { ...raw };
    delete entries[id][idField];
  });

  return entries;
}

function loadWorldCatalog() {
  const worldRoot = path.join(__dirname, '../data/world');
  const settings = JSON.parse(fs.readFileSync(path.join(worldRoot, 'settings.json'), 'utf8'));

  return {
    chunkSize: settings.chunkSize,
    gridSize: settings.gridSize,
    defaultBiome: settings.defaultBiome,
    biomePrefabPools: settings.biomePrefabPools || {},
    biomePrefabDensity: settings.biomePrefabDensity || {},
    biomes: loadDirectoryAsMap(path.join(worldRoot, 'biomes')),
    prefabs: loadDirectoryAsMap(path.join(worldRoot, 'prefabs')),
    regions: loadDirectoryAsMap(path.join(worldRoot, 'regions'))
  };
}

module.exports = {
  loadWorldCatalog
};
