export const money = v => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2}).format(Number(v||0)) + ' ₽'
export const nfmt = v => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:1}).format(Number(v||0))
export const dateISO = (d = new Date()) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
export const monthISO = d => String(d).slice(0,7) + '-01'
export const plusDays = (d,n) => { let x=new Date(`${d}T12:00:00`); x.setDate(x.getDate()+n); return dateISO(x) }
export const weekStart = (d) => {let x=new Date(`${d}T12:00:00`); let w=(x.getDay()+6)%7; x.setDate(x.getDate()-w); return dateISO(x)}
export const weekDays = d => Array.from({length:7},(_,i)=>plusDays(weekStart(d),i))
export const formatDate = (d,opts={day:'numeric',month:'long'}) => new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU',opts)
export const monthLabel = d => new Date(`${monthISO(d)}T12:00:00`).toLocaleDateString('ru-RU',{month:'long',year:'numeric'})
export const shiftMonth = (d,n) => { const x=new Date(`${monthISO(d)}T12:00:00`); x.setMonth(x.getMonth()+n); return dateISO(new Date(x.getFullYear(),x.getMonth(),1)) }
export const sum = arr => arr.reduce((s,v)=>s+Number(v||0),0)
export const clamp0 = v => Math.max(0,Math.round(Number(v||0)*100)/100)
export const initials = name => (name||'—').split(' ').slice(0,2).map(s=>s[0]||'').join('').toUpperCase()
export const chargePaid = (charge,payments) => sum(payments.filter(p=>p.charge_id===charge?.id).map(p=>p.amount))
export const outstanding = (charge,payments) => clamp0(Number(charge?.amount||0)-chargePaid(charge,payments))
export const statusForClient = (client,charges,payments,month) => {
 const charge=charges.find(c=>c.client_id===client.id&&c.type==='monthly'&&c.billing_month===month)
 if(!charge) return {key:'none', label:'Не начислено', amount:0,paid:0,left:0,charge:null}
 const paid=chargePaid(charge,payments),left=outstanding(charge,payments)
 return {key:left<0.01?'paid':paid>0?'partial':'unpaid',label:left<0.01?'Оплачено':paid>0?'Частично':'Не оплачено',amount:Number(charge.amount),paid,left,charge}
}
export const errorMessage = err => err?.message || 'Неизвестная ошибка'
export const csvEscape = value => '"'+String(value??'').replace(/"/g,'""')+'"'
export const csv = rows => rows.map(r=>r.map(csvEscape).join(';')).join('\n')
export const download = (filename,content,type='application/json;charset=utf-8') => {
 const blob=new Blob(['\uFEFF',content],{type}); const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
