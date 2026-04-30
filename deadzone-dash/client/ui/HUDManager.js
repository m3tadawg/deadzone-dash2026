const FALLBACK_INVENTORY = [null, null, null, null, null];

function clampPercent(value, maxValue) {
  if (!maxValue || maxValue <= 0) return 0;
  return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

function prettyWeaponName(weaponId) {
  if (!weaponId) return "Unknown";
  return weaponId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyItemName(item) {
  if (!item) return "Empty";
  const id = typeof item === "object" ? item.id : item;
  if (!id) return "Empty";
  return prettyWeaponName(id);
}

function ammoLabel(item) {
  if (!item) return "Open";
  if (item.clip == null && item.reserve == null) return "Ready";
  if ((item.clip || 0) <= 0 && (item.reserve || 0) <= 0) return "Dry";
  return `${item.clip ?? 0}/${item.reserve ?? 0}`;
}

class HUDManager {
  constructor() {
    this.els = {
      searchPrompt: document.getElementById("searchPrompt"),
      healthText: document.getElementById("healthText"),
      healthFill: document.getElementById("healthFill"),
      staminaText: document.getElementById("staminaText"),
      staminaFill: document.getElementById("staminaFill"),
      waveValue: document.getElementById("waveValue"),
      killsValue: document.getElementById("killsValue"),
      scoreValue: document.getElementById("scoreValue"),
      weaponName: document.getElementById("weaponName"),
      ammoCount: document.getElementById("ammoCount"),
      inventoryBar: document.getElementById("inventoryBar"),
      notifications: document.getElementById("notifications"),
      vitalsPanel: document.getElementById("vitalsPanel"),
      weaponPanel: document.getElementById("weaponPanel"),
      searchProgressContainer: document.getElementById("searchProgressContainer"),
      searchProgressFill: document.getElementById("searchProgressFill")
    };
    this._notificationTimeout = null;
    this._maxHealth = 100;
    this._maxStamina = 100;
    this._inventorySignature = "";
    this._activeSlot = 0;
    this._inventorySlots = [];

    for (let i = 0; i < 5; i += 1) {
      const slot = document.createElement("div");
      slot.className = `inv-slot ${i === 0 ? "active" : ""}`.trim();

      const slotIndex = document.createElement("div");
      slotIndex.className = "slot-index";
      slotIndex.textContent = `${i + 1}`;

      const itemName = document.createElement("div");
      itemName.className = "slot-name";

      const itemAmmo = document.createElement("div");
      itemAmmo.className = "slot-ammo";

      slot.append(slotIndex, itemName, itemAmmo);
      this.els.inventoryBar.appendChild(slot);
      this._inventorySlots.push({ slot, itemName, itemAmmo });
    }

    this.renderInventory(FALLBACK_INVENTORY);
  }

  updateSearchProgress(percent) {
    if (!this.els.searchProgressContainer || !this.els.searchProgressFill) return;

    if (percent > 0 && percent < 100) {
      this.els.searchProgressContainer.style.display = "flex";
      this.els.searchProgressFill.style.width = `${percent}%`;
      if (this.els.searchPrompt) this.els.searchPrompt.style.display = "none";
    } else {
      this.els.searchProgressContainer.style.display = "none";
      this.els.searchProgressFill.style.width = "0%";
    }
  }

  setSearchPromptVisible(isVisible) {
    this.els.searchPrompt.style.display = isVisible ? "block" : "none";
  }

  showNotification(text, tone = "info") {
    if (this._notificationTimeout) {
      clearTimeout(this._notificationTimeout);
      this._notificationTimeout = null;
    }

    this.els.notifications.innerText = text;
    this.els.notifications.className = `notification ${tone}`;
    this._notificationTimeout = setTimeout(() => {
      this.els.notifications.innerText = "";
      this.els.notifications.className = "notification";
      this._notificationTimeout = null;
    }, 3000);
  }

  updateFromSnapshot(snapshot, localPlayerId) {
    const localPlayer = snapshot.players[localPlayerId];
    if (!localPlayer) return;

    this._maxHealth = snapshot.hud?.maxHealth ?? this._maxHealth;
    this._maxStamina = snapshot.hud?.maxStamina ?? this._maxStamina;

    const maxHealth = this._maxHealth;
    const maxStamina = this._maxStamina;
    const health = Math.max(0, Math.round(localPlayer.health ?? 0));
    const stamina = Math.max(0, Math.round(localPlayer.stamina ?? maxStamina));

    const healthPercent = clampPercent(health, maxHealth);
    this.els.healthText.textContent = `${health} / ${maxHealth}`;
    this.els.healthFill.style.width = `${healthPercent}%`;

    if (healthPercent <= 25) {
      this.els.vitalsPanel.classList.remove("neon-cyan");
      this.els.vitalsPanel.classList.add("health-critical");
      this.els.healthFill.classList.replace("fill-cyan", "fill-red");
      this.els.healthText.classList.replace("text-cyan", "text-red");
    } else {
      this.els.vitalsPanel.classList.remove("health-critical");
      this.els.vitalsPanel.classList.add("neon-cyan");
      this.els.healthFill.classList.replace("fill-red", "fill-cyan");
      this.els.healthText.classList.replace("text-red", "text-cyan");
    }

    this.els.staminaText.textContent = `${stamina} / ${maxStamina}`;
    this.els.staminaFill.style.width = `${clampPercent(stamina, maxStamina)}%`;

    this.els.waveValue.textContent = String(snapshot.hud?.wave ?? 1);
    this.els.killsValue.textContent = String(localPlayer.kills ?? 0);
    this.els.scoreValue.textContent = String(localPlayer.score ?? 0);
    this.els.weaponName.textContent = prettyWeaponName(localPlayer.weapon);

    const currentAmmo = localPlayer.ammo?.current;
    const reserveAmmo = localPlayer.ammo?.reserve;
    this.els.ammoCount.textContent = currentAmmo == null ? "INF" : `${currentAmmo}/${reserveAmmo ?? 0}`;
    this.els.weaponPanel.classList.toggle("weapon-dry", currentAmmo === 0 && (reserveAmmo ?? 0) === 0);

    this.renderInventory(localPlayer.inventory || FALLBACK_INVENTORY, localPlayer.selectedWeaponSlot || 0);
  }

  renderInventory(inventory = FALLBACK_INVENTORY, selectedSlot = 0) {
    const slots = inventory.slice(0, 5);
    while (slots.length < 5) slots.push(null);

    const inventorySignature = `${JSON.stringify(slots)}::${selectedSlot}`;
    if (inventorySignature === this._inventorySignature) return;

    this._inventorySignature = inventorySignature;
    this._activeSlot = selectedSlot;
    slots.forEach((item, index) => {
      const slotEls = this._inventorySlots[index];
      const status = ammoLabel(item);
      slotEls.itemName.textContent = prettyItemName(item);
      slotEls.itemAmmo.textContent = status;
      slotEls.slot.classList.toggle("active", index === this._activeSlot);
      slotEls.slot.classList.toggle("empty", !item);
      slotEls.slot.classList.toggle("dry", item && status === "Dry");
    });
  }
}

export { HUDManager };
