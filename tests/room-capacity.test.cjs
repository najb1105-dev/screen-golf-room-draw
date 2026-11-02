const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function game() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = vm.createContext({});
  // Load the real allocation functions; browser wiring is covered in UI checks.
  vm.runInContext(script.slice(0, script.lastIndexOf("el('addBtn').addEventListener")), context);
  return context;
}
function people(g, right, left = 0) {
  g.participants = Array.from({ length: right + left }, (_, i) => ({
    id: i + 1, seq: i + 1, name: '참가자' + (i + 1), hand: i < right ? 'R' : 'L', removed: false
  }));
}

test('room draw honors different room sizes without moving existing assignments', () => {
  for (let run = 0; run < 50; run++) {
    const g = game();
    g.selectedRooms = [1, 5];
    g.roomCapacities = { 1: 2, 5: 6 };
    people(g, 5, 3);
    assert.equal(g.validation()[0], 'info');
    const snapshot = {};
    for (const p of g.participants) {
      const r = g.randomRoomFor(p);
      assert.ok(r, 'Every participant has an available room');
      if (p.hand === 'L') assert.equal(r, 5);
      g.assignments[p.id] = r;
      for (const [id, assigned] of Object.entries(snapshot)) assert.equal(g.assignments[id], assigned);
      snapshot[p.id] = r;
    }
    assert.equal(Object.values(g.assignments).filter(r => r === 1).length, 2);
    assert.equal(Object.values(g.assignments).filter(r => r === 5).length, 6);
  }
});

test('validation uses the configured total, not six seats for every room', () => {
  const g = game();
  g.selectedRooms = [1, 5];
  g.roomCapacities = { 1: 2, 5: 3 };
  people(g, 6);
  assert.equal(g.validation()[0], 'error');
});

test('left-handed players cannot exceed the configured left-handed room seats', () => {
  const g = game();
  g.selectedRooms = [1, 5];
  g.roomCapacities = { 1: 6, 5: 2 };
  people(g, 5, 3);
  assert.equal(g.validation()[0], 'error');
});

test('full rooms are excluded from later draws', () => {
  const g = game();
  g.selectedRooms = [1, 5];
  g.roomCapacities = { 1: 2, 5: 6 };
  people(g, 8);
  g.assignments = { 1: 1, 2: 1, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 };
  assert.equal(g.randomRoomFor(g.participants[7]), 5);
});

test('manual settings permit a one-person room', () => {
  const g = game();
  g.selectedRooms = [1];
  g.roomCapacities = { 1: 1 };
  people(g, 1);
  assert.equal(g.validation()[0], 'info');
  assert.equal(g.randomRoomFor(g.participants[0]), 1);
});

test('automatic rooms receive the remaining participants beside a manual room', () => {
  const g = game();
  g.selectedRooms = [1, 2];
  g.roomCapacities = { 1: 1 };
  people(g, 5);
  assert.equal(g.validation()[0], 'info');
  assert.deepEqual(JSON.parse(JSON.stringify(g.roomTargets())), { 1: 1, 2: 4 });
});

test('starting requires enough participants to fill manually configured rooms', () => {
  const g = game();
  g.selectedRooms = [1, 2];
  g.roomCapacities = { 1: 3, 2: 4 };
  people(g, 6);
  assert.notEqual(g.validation()[0], 'info');
});

test('automatic targets preserve already assigned people after new participants arrive', () => {
  const g = game();
  g.selectedRooms = [1, 5];
  people(g, 6, 4);
  g.gameStarted = true;
  g.assignments = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 5, 6: 5, 7: 5, 8: 5 };
  assert.equal(g.randomRoomFor(g.participants[8]), 5);
  g.assignments[9] = 5;
  assert.equal(g.randomRoomFor(g.participants[9]), 5);
});

test('invalid manually configured room sizes are rejected', () => {
  for (const size of [0, 7, 1.5, NaN]) {
    const g = game();
    g.selectedRooms = [1];
    g.roomCapacities = { 1: size };
    people(g, 4);
    assert.equal(g.validation()[0], 'error');
  }
});

test('manual normal-room targets cannot consume seats needed by left-handed players', () => {
  const g = game();
  g.selectedRooms = [1, 5];
  g.roomCapacities = { 1: 6 };
  people(g, 4, 6);
  assert.equal(g.validation()[0], 'error');
});
