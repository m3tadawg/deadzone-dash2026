class WeaponLoadoutSystem {
  constructor(weaponsConfig = [], lootConfig = {}) {
    this.weaponById = new Map(weaponsConfig.map((weapon) => [weapon.id, weapon]));
    this.lootConfig = lootConfig;
    if (this.lootConfig.tiers) {
      this.lootConfig.tiers.sort((a, b) => (a.minElapsedSeconds || 0) - (b.minElapsedSeconds || 0));
    }
  }

  createInitialLoadout(defaultWeapon = "pistol") {
    const slotCount = this.lootConfig.maxWeaponSlots || 5;
    const inventory = new Array(slotCount).fill(null);
    inventory[0] = defaultWeapon;

    return {
      weapon: defaultWeapon,
      selectedWeaponSlot: 0,
      inventory
    };
  }

  switchToSlot(player, slotIndex) {
    if (!player || !Array.isArray(player.inventory)) return false;
    if (slotIndex < 0 || slotIndex >= player.inventory.length) return false;

    const slotWeapon = player.inventory[slotIndex];
    if (!slotWeapon || !this.weaponById.has(slotWeapon)) return false;

    player.selectedWeaponSlot = slotIndex;
    player.weapon = slotWeapon;
    return true;
  }

  tryAwardZombieLoot(player, elapsedMs, lootMultiplier = 1) {
    const dropChance = Math.min(0.95, (this.lootConfig.dropChance || 0) * (lootMultiplier || 1));
    if (Math.random() > dropChance) return null;

    const weaponId = this.pickLootWeapon(elapsedMs / 1000);
    if (!weaponId) return null;

    return this.addWeaponToInventory(player, weaponId);
  }

  pickLootWeapon(elapsedSeconds) {
    const tiers = this.lootConfig.tiers || [];

    let activeTier = tiers[0] || null;
    tiers.forEach((tier) => {
      if ((tier.minElapsedSeconds || 0) <= elapsedSeconds) {
        activeTier = tier;
      }
    });

    if (!activeTier || !activeTier.weights) return null;

    const validEntries = Object.entries(activeTier.weights)
      .filter(([weaponId, weight]) => this.weaponById.has(weaponId) && weight > 0);

    if (!validEntries.length) return null;

    const totalWeight = validEntries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (const [weaponId, weight] of validEntries) {
      roll -= weight;
      if (roll <= 0) return weaponId;
    }

    return validEntries[validEntries.length - 1][0];
  }

  addWeaponToInventory(player, weaponId) {
    if (!player || !this.weaponById.has(weaponId)) return null;
    if (!Array.isArray(player.inventory)) player.inventory = [];

    const existingIndex = player.inventory.indexOf(weaponId);
    if (existingIndex >= 0) {
      this.switchToSlot(player, existingIndex);
      return { weaponId, slot: existingIndex, isNew: false };
    }

    const emptyIndex = player.inventory.findIndex((item) => !item);
    if (emptyIndex >= 0) {
      player.inventory[emptyIndex] = weaponId;
      this.switchToSlot(player, emptyIndex);
      return { weaponId, slot: emptyIndex, isNew: true };
    }

    const replaceIndex = player.selectedWeaponSlot || 0;
    player.inventory[replaceIndex] = weaponId;
    this.switchToSlot(player, replaceIndex);
    return { weaponId, slot: replaceIndex, isNew: true, replaced: true };
  }
}

module.exports = WeaponLoadoutSystem;
