import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(await readFile(new URL('./planner.js', import.meta.url), 'utf8'), context);
const { propose, validate, validDate, dateKey } = context.GymPlanner;
const copy = x => JSON.parse(JSON.stringify(x));
const session = () => ({ date: '2026-01-10', name: 'Mi sesión', status: 'completed', exercises: [{ id: 0, sets: [{ weight: 10, reps: 8, unit: 'kg', done: true }] }], minutes: 25, notes: '', effort: 'moderado', discomfort: 'sin molestias' });

test('plantillas cortas, exclusiones y equilibrio de cuerpo completo', () => {
  assert.deepEqual(copy(propose('completo',25).ids), [8,0,5]);
  assert.equal(propose('superior',40).ids.length,5);
  assert.ok(!propose('completo',40,[0,8]).ids.includes(0));
  assert.equal(propose('inferior',40,[8,10,11,9]).ids.length,0);
});
test('fechas locales y validación de días reales', () => {
  assert.equal(dateKey(new Date(2026,10,16)), '2026-11-16');
  assert.ok(validDate('2024-02-29'));
  assert.ok(!validDate('2026-02-29'));
  assert.ok(!validDate('2026-13-01'));
});
test('respaldo conserva registros y rechaza datos corruptos', () => {
  const data={version:1,sessions:[session()]};
  assert.equal(validate(data),data);
  for(const mutate of [
    d=>d.version=2,
    d=>d.sessions.push(session()),
    d=>d.sessions[0].exercises[0].sets[0].reps=-1,
    d=>d.sessions[0].exercises[0].sets[0].reps=8.5,
    d=>d.sessions[0].exercises[0].sets[0].weight=Infinity,
    d=>d.sessions[0].exercises[0].id=100,
    d=>d.sessions[0].date='2099-01-01',
    d=>d.sessions[0].notes=null
  ]) { const bad=copy(data);mutate(bad);assert.throws(()=>validate(bad)); }
  const future=copy(data);future.sessions[0].date='2099-01-01';future.sessions[0].status='planned';
  assert.doesNotThrow(()=>validate(future));
});
