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
  return String(id).replaceAll("_", " ");
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
      vitalsPanel: document.getElementById("vitalsPanel")
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

      const itemName = document.createElement("div");
      const slotIndex = document.createElement("div");
      slotIndex.className = "slot-index";
      slotIndex.textContent = `Slot ${i + 1}`;

      slot.append(itemName, slotIndex);
      this.els.inventoryBar.appendChild(slot);
      this._inventorySlots.push(itemName);
    }

    this.renderInventory(FALLBACK_INVENTORY);
  }

  setSearchPromptVisible(isVisible) {
    this.els.searchPrompt.style.display = isVisible ? "block" : "none";
  }

  showNotification(text) {
    if (this._notificationTimeout) {
      clearTimeout(this._notificationTimeout);
      this._notificationTimeout = null;
    }

    this.els.notifications.innerText = text;
    this._notificationTimeout = setTimeout(() => {
      this.els.notifications.innerText = "";
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

    // Toggle Critical Status
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
    this.els.ammoCount.textContent = currentAmmo == null ? "∞" : `${currentAmmo}/${reserveAmmo ?? 0}`;

    this.renderInventory(localPlayer.inventory || FALLBACK_INVENTORY, localPlayer.selectedWeaponSlot || 0);
  }

  renderInventory(inventory = FALLBACK_INVENTORY, selectedSlot = 0) {
    const slots = inventory.slice(0, 5);
    while (slots.length < 5) slots.push(null);

    const inventorySignature = `${slots.map((item) => item ?? "").join("|")}::${selectedSlot}`;
    if (inventorySignature === this._inventorySignature) return;

    this._inventorySignature = inventorySignature;
    this._activeSlot = selectedSlot;
    slots.forEach((item, index) => {
      this._inventorySlots[index].textContent = prettyItemName(item);
      this._inventorySlots[index].parentElement.classList.toggle("active", index === this._activeSlot);
    });
  }
}

export { HUDManager };
