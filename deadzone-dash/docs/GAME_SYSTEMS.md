# DeadZone Dash — Game Systems Contract

This document defines ALL gameplay systems and their interactions.
No system may be implemented in isolation without adhering to this contract.

---

# 1. GLOBAL DESIGN RULE

All systems must be:

* Modular
* Data-driven
* Interoperable via shared state

NO system may directly depend on another.
All interaction must occur via shared components/state.

---

# 2. SHARED GAME STATE (CRITICAL)

Every entity in the game must support:

```json
{
  "position": { "x": 0, "y": 0, "z": 0 },
  "velocity": { "x": 0, "y": 0, "z": 0 },
  "health": number,
  "statusEffects": [],
  "tags": []
}
```

---

# 3. STATUS EFFECT SYSTEM (THIS IS THE KEY)

ALL temporary effects must use ONE unified system:

## Examples:

* Perks
* Fire damage
* Poison (spitter acid)
* Weather effects
* Buffs/debuffs

## Structure:

```json
{
  "type": "burning",
  "duration": 5,
  "tickRate": 1,
  "effect": {
    "damagePerTick": 2
  }
}
```

## RULE:

👉 Weather, perks, and weapons MUST use this system.

---

# 4. WEAPON SYSTEM CONTRACT

Weapons must NOT apply direct logic.

Instead they emit:

```json
{
  "type": "damage",
  "amount": 10,
  "effects": ["burning", "knockback"]
}
```

CombatSystem interprets this.

---

# 5. PERK SYSTEM CONTRACT

Perks are just **temporary modifiers** applied via statusEffects.

Examples:

* Damage Boost → modifies outgoing damage
* Speed Boost → modifies velocity
* Loot Magnet → modifies pickup radius

## RULE:

👉 Perks must NEVER contain gameplay logic themselves.

---

# 6. WEATHER SYSTEM CONTRACT

Weather must NOT directly modify systems.

Instead it applies GLOBAL status effects:

Examples:

* Fog:

  * reduces visibility radius
* Rain:

  * reduces fire damage
* Storm:

  * disables turrets (tag-based)

## RULE:

👉 Weather modifies the world via effects, not logic branches.

---

# 7. AI SYSTEM CONTRACT

AI must ONLY read:

* player positions
* tags
* statusEffects

AI must NOT:

* directly modify game rules
* override physics

---

# 8. EVENT SYSTEM CONTRACT

Events (airdrops, extraction) must:

* Spawn entities
* Apply pressure via AI
* NEVER modify player stats directly

---

# 9. CHALLENGE SYSTEM CONTRACT

Challenges observe gameplay events:

* kills
* movement
* damage

They NEVER:

* alter gameplay directly
* inject logic

---

# 10. INTERACTION FLOW (IMPORTANT)

All gameplay follows this chain:

```plaintext
Input → Action → Effect → Status → Resolution
```

Example:

Player shoots →
Weapon emits damage →
CombatSystem applies →
StatusEffect triggers →
Health updated

---

# 11. EXTENSIBILITY RULE

If adding a new feature:

Ask:

* Can this be a statusEffect?
* Can this be data-driven?

If not → redesign it.

---

# 12. LOOT SYSTEM CONTRACT

All world-space items must follow the drop-and-collect flow:

* **Spawning**: Items are spawned as `droppedItem` entities with a unique ID and a `weaponId` reference.
* **Collection**: Players collect items via proximity (server-side check).
* **Progression**: Drop rates must be tiered based on game duration (stored in `weapon_loot.json`).

## RULE:
👉 Never award loot directly to a player's inventory on kill. It must always be an intermediate world entity.

---

# 13. HAZARD SYSTEM CONTRACT

Environmental hazards (Fire, Acid, Gas) must be separated into two components:

1. **Logical Hazard**: Server-side data (`activeHazards`) that handles damage and status effect application.
2. **Visual Zone**: Client-side representation (`damageZones` or `firePools`) synced via snapshot.

## RULE:
👉 Visuals must reflect the logical state. Use `InstancedMesh` for any mass-particle visuals (embers, sparks) to maintain performance.

---

# FINAL RULE

If a system requires modifying another system’s code:

👉 You are breaking the architecture.
