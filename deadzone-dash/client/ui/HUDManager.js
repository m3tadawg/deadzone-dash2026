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
      notifications: document.getElementById("notifications")
    };

    this.renderInventory(FALLBACK_INVENTORY);
  }

  setSearchPromptVisible(isVisible) {
    this.els.searchPrompt.style.display = isVisible ? "block" : "none";
  }

  showNotification(text) {
    this.els.notifications.innerText = text;
    setTimeout(() => {
      this.els.notifications.innerText = "";
    }, 3000);
  }

  updateFromSnapshot(snapshot, localPlayerId) {
    const localPlayer = snapshot.players[localPlayerId];
    if (!localPlayer) return;

    const maxHealth = 100;
    const maxStamina = 100;
    const health = Math.max(0, Math.round(localPlayer.health ?? 0));
    const stamina = Math.max(0, Math.round(localPlayer.stamina ?? maxStamina));

    this.els.healthText.textContent = `${health} / ${maxHealth}`;
    this.els.healthFill.style.width = `${clampPercent(health, maxHealth)}%`;
    this.els.staminaText.textContent = `${stamina} / ${maxStamina}`;
    this.els.staminaFill.style.width = `${clampPercent(stamina, maxStamina)}%`;

    this.els.waveValue.textContent = String(snapshot.hud?.wave ?? 1);
    this.els.killsValue.textContent = String(localPlayer.kills ?? 0);
    this.els.scoreValue.textContent = String(localPlayer.score ?? 0);
    this.els.weaponName.textContent = prettyWeaponName(localPlayer.weapon);

    const currentAmmo = localPlayer.ammo?.current;
    const reserveAmmo = localPlayer.ammo?.reserve;
    this.els.ammoCount.textContent = currentAmmo == null ? "∞" : `${currentAmmo}/${reserveAmmo ?? 0}`;

    this.renderInventory(localPlayer.inventory || FALLBACK_INVENTORY);
  }

  renderInventory(inventory = FALLBACK_INVENTORY) {
    const slots = inventory.slice(0, 5);
    while (slots.length < 5) slots.push(null);

    this.els.inventoryBar.innerHTML = slots
      .map((item, i) => `
      <div class="inv-slot ${i === 0 ? "active" : ""}">
        <div>${item ? String(item).replaceAll("_", " ") : "Empty"}</div>
        <div class="slot-index">Slot ${i + 1}</div>
      </div>
    `)
      .join("");
  }
}

export { HUDManager };
