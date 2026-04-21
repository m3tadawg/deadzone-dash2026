
module.exports = {
  update(zombie, players) {
    // simple chase logic
    const target = Object.values(players)[0];
    if (!target) return;
    zombie.x += (target.x - zombie.x) * 0.01;
    zombie.z += (target.z - zombie.z) * 0.01;
  }
};
