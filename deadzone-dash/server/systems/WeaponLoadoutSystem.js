class WeaponLoadoutSystem {
  constructor(weaponsConfig = [], lootConfig = {}) {
    this.weaponById = new Map(weaponsConfig.map((weapon) => [weapon.id, weapon]));
    this.lootConfig = lootConfig;
    if (this.lootConfig.tiers) {
      this.lootConfig.tiers.sort((a, b) => (a.minElapsedSeconds || 0) - (b.minElapsedSeconds || 0));
    }
  }

  createInitialLoadout(defaultWeaponId = "pistol") {
    const slotCount = this.lootConfig.maxWeaponSlots || 5;
    const inventory = new Array(slotCount).fill(null);
    
    let initialAmmo = { current: null, reserve: null };
    const weapon = this.weaponById.get(defaultWeaponId);
    if (weapon) {
      initialAmmo = {
        current: weapon.clipSize || 0,
        reserve: weapon.maxReserve || 0
      };
      inventory[0] = {
        id: defaultWeaponId,
        clip: initialAmmo.current,
        reserve: initialAmmo.reserve
      };
    }

    return {
      weapon: defaultWeaponId,
      selectedWeaponSlot: 0,
      inventory,
      ammo: initialAmmo
    };
  }

  switchToSlot(player, slotIndex) {
    if (!player || !Array.isArray(player.inventory)) return false;
    if (slotIndex < 0 || slotIndex >= player.inventory.length) return false;

    const slotItem = player.inventory[slotIndex];
    if (!slotItem || !this.weaponById.has(slotItem.id)) return false;

    player.selectedWeaponSlot = slotIndex;
    player.weapon = slotItem.id;
    
    // Sync current ammo for the HUD
    player.ammo = {
      current: slotItem.clip,
      reserve: slotItem.reserve
    };

    return true;
  }

  rollForLoot(elapsedSeconds, lootMultiplier = 1) {
    const tiers = this.lootConfig.tiers || [];
    let activeTier = tiers[0] || null;
    
    tiers.forEach((tier) => {
      if ((tier.minElapsedSeconds || 0) <= elapsedSeconds) {
        activeTier = tier;
      }
    });

    if (!activeTier) return null;

    const baseChance = activeTier.dropChance !== undefined ? activeTier.dropChance : (this.lootConfig.dropChance || 0);
    const effectiveChance = Math.min(0.95, baseChance * (lootMultiplier || 1));

    if (Math.random() > effectiveChance) return null;

    return this.pickLootWeapon(elapsedSeconds);
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

    // Filter weights to ensure we only pick valid items defined in weapon_loot.json weights
    // (Note: weapons config only has weapons, so we need to handle ammo/health/perks differently if they aren't weapons)
    const validEntries = Object.entries(activeTier.weights);

    if (!validEntries.length) return null;

    const totalWeight = validEntries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (const [id, weight] of validEntries) {
      roll -= weight;
      if (roll <= 0) return id;
    }

    return validEntries[validEntries.length - 1][0];
  }

  addWeaponToInventory(player, weaponId, autoEquip = true) {
    if (!player || !this.weaponById.has(weaponId)) return null;
    if (!Array.isArray(player.inventory)) player.inventory = [];

    const weapon = this.weaponById.get(weaponId);

    const existingIndex = player.inventory.findIndex(item => item && item.id === weaponId);
    if (existingIndex >= 0) {
      // If we already have it, we add ammo to the reserve
      const item = player.inventory[existingIndex];
      if (weapon.type === 'thrown') {
        item.reserve += 1;
      } else if (weapon.type !== 'melee') {
        item.reserve += (weapon.clipSize || 10) * 2;
      }

      // Sync HUD if this is the active weapon
      if (player.weapon === item.id) {
        player.ammo = {
          current: item.clip,
          reserve: item.reserve
        };
      }

      if (autoEquip) this.switchToSlot(player, existingIndex);
      return { weaponId, slot: existingIndex, isNew: false };
    }

    const newItem = {
      id: weaponId,
      clip: weapon.clipSize || 0,
      reserve: weapon.maxReserve || 0
    };

    const emptyIndex = player.inventory.findIndex((item) => !item);
    if (emptyIndex >= 0) {
      player.inventory[emptyIndex] = newItem;
      if (autoEquip) this.switchToSlot(player, emptyIndex);
      return { weaponId, slot: emptyIndex, isNew: true };
    }

    const replaceIndex = player.selectedWeaponSlot || 0;
    player.inventory[replaceIndex] = newItem;
    if (autoEquip) this.switchToSlot(player, replaceIndex);
    return { weaponId, slot: replaceIndex, isNew: true, replaced: true };
  }

  refillAmmo(player) {
    let slotIndex = player.selectedWeaponSlot || 0;
    let item = player.inventory[slotIndex];
    
    // If holding melee or nothing, find the first valid ranged weapon to apply ammo to
    if (!item || !this.weaponById.has(item.id) || this.weaponById.get(item.id).type === 'melee') {
      const validIndex = player.inventory.findIndex(i => i && this.weaponById.get(i.id).type !== 'melee');
      if (validIndex >= 0) {
        slotIndex = validIndex;
        item = player.inventory[slotIndex];
      } else {
        return false;
      }
    }

    const weapon = this.weaponById.get(item.id);
    if (!weapon) return false;

    // Add ammo instead of capping at max
    if (weapon.type === 'thrown') {
      item.reserve += 1;
    } else {
      item.reserve += (weapon.clipSize || 10) * 3;
    }
    
    // Sync HUD if this is the active weapon
    if (player.weapon === item.id) {
      player.ammo = {
        current: item.clip,
        reserve: item.reserve
      };
    }
    return true;
  }

  reload(player) {
    const slotIndex = player.selectedWeaponSlot || 0;
    const item = player.inventory[slotIndex];
    if (!item) return false;

    const weapon = this.weaponById.get(item.id);
    if (!weapon || weapon.type === 'melee') return false;

    const clipSize = weapon.clipSize || 0;
    const currentClip = item.clip || 0;
    const reserve = item.reserve || 0;

    if (currentClip >= clipSize || reserve <= 0) return false;

    const needed = clipSize - currentClip;
    const amountToTransfer = Math.min(needed, reserve);

    item.clip += amountToTransfer;
    item.reserve -= amountToTransfer;

    // Sync HUD
    if (player.weapon === item.id) {
      player.ammo = {
        current: item.clip,
        reserve: item.reserve
      };
    }
    return true;
  }

  autoReload(player) {
    const slotIndex = player.selectedWeaponSlot || 0;
    const item = player.inventory[slotIndex];
    if (!item || (item.clip || 0) > 0) return false;

    return this.reload(player);
  }

  checkDepletion(player) {
    const slotIndex = player.selectedWeaponSlot || 0;
    const item = player.inventory[slotIndex];
    if (!item) return false;

    const weapon = this.weaponById.get(item.id);
    if (!weapon) return false;

    const totalAmmo = (item.clip || 0) + (item.reserve || 0);

    // If it's a consumable (thrown) and empty, remove it
    if (weapon.type === 'thrown' && totalAmmo <= 0) {
      player.inventory[slotIndex] = null;
      
      // Try to find another weapon or fallback to knife (slot 0)
      let fallbackSlot = 0;
      for (let i = 0; i < player.inventory.length; i++) {
        if (player.inventory[i]) {
          fallbackSlot = i;
          break;
        }
      }
      this.switchToSlot(player, fallbackSlot);
      return true;
    }

    return false;
  }
}

module.exports = WeaponLoadoutSystem;
