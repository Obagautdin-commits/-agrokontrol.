import test from 'node:test'
import assert from 'node:assert/strict'
import {statusForClient,chargePaid,outstanding,monthISO,weekDays,weekStart} from '../src/utils.js'

const client={id:'client1',full_name:'Тестовый клиент',area_m2:3000,rate_per_m2:7,visits_per_month:4}
const charge={id:'charge1',client_id:'client1',type:'monthly',billing_month:'2026-11-01',amount:21000,area_snapshot:3000,rate_snapshot:7}

test('3000 м² × 7 ₽/м² = 21000 ₽ в месяц; 5250 ₽ — одна четверть',()=>{
 assert.equal(client.area_m2*client.rate_per_m2,21000)
 assert.equal(charge.amount/client.visits_per_month,5250)
})
test('Без поступлений клиент не оплатил месяц',()=>{
 const s=statusForClient(client,[charge],[],'2026-11-01')
 assert.equal(s.key,'unpaid')
 assert.equal(s.left,21000)
})
test('Одна недельная часть меняет статус на частично оплачено',()=>{
 const p=[{charge_id:'charge1',amount:5250}]
 const s=statusForClient(client,[charge],p,'2026-11-01')
 assert.equal(chargePaid(charge,p),5250)
 assert.equal(s.key,'partial')
 assert.equal(s.left,15750)
})
test('После полной оплаты остаток равен нулю',()=>{
 const p=[{charge_id:'charge1',amount:5250},{charge_id:'charge1',amount:15750}]
 assert.equal(outstanding(charge,p),0)
 assert.equal(statusForClient(client,[charge],p,'2026-11-01').key,'paid')
})
test('Исторический месяц не изменяется при выборе другого месяца',()=>{
 assert.equal(statusForClient(client,[charge],[],'2026-12-01').key,'none')
 assert.equal(monthISO('2026-11-27'),'2026-11-01')
})
test('Понедельник — начало недели; воскресенье — последний день',()=>{
 assert.equal(weekStart('2026-11-10'),'2026-11-09')
 const days=weekDays('2026-11-10')
 assert.equal(days.length,7)
 assert.equal(days[6],'2026-11-15')
})
