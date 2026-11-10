import React, {useEffect,useMemo,useState} from 'react'
import {
  Sprout, Menu, X, Home, Users, Coins, Wallet, AlertTriangle, CalendarDays,
  MapPin, Map, BarChart3, Tag, CalendarRange, MessageSquare, Archive, Download,
  Settings, LogOut, Bell, Search, Plus, Check, Clock, ChevronRight, ChevronLeft,
  CreditCard, Banknote, TrendingUp, Receipt, Building2, RefreshCw, ShieldCheck,
  Trash2, Edit3, CheckCircle2, ArrowUpRight, UserRound, LockKeyhole, FileDown,
  Filter, CalendarCheck, ClipboardCheck, Save, AlertCircle, Eye
} from 'lucide-react'
import {supabase,configured} from './supabase'
import {
 money,nfmt,dateISO,monthISO,plusDays,weekStart,weekDays,formatDate,monthLabel,shiftMonth,
 sum,initials,chargePaid,outstanding,statusForClient,errorMessage,download,csv
} from './utils'

const NAV = [
 ['dashboard','Главная',Home],['clients','Клиенты',Users],['payments','Оплаты',Coins],
 ['debts','Долги',AlertTriangle],['visits','Календарь визитов',CalendarDays],
 ['routes','Маршруты',MapPin],['districts','Районы и населённые пункты',Map],
 ['reports','Отчёты и аналитика',BarChart3],['tariffs','Тарифы',Tag],
 ['seasons','Сезоны',CalendarRange],['consultations','Консультации',MessageSquare],
 ['archive','Архив',Archive],['backups','Резервные копии',Download],['settings','Настройки',Settings]
]
const EMPTY = {clients:[],charges:[],payments:[],visits:[],expenses:[],audit_log:[]}
const ruDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const yearOf = d => String(d).slice(0,4)
const paymentCharge = (p,charges) => charges.find(c=>c.id===p.charge_id)
const timeShort = t => String(t||'').slice(0,5)
const sameMonth = (d,m) => String(d||'').slice(0,7)===m.slice(0,7)
const isUnpaid = (c,ps) => outstanding(c,ps)>0.009
const Icon = ({icon:Component,size=19,...props}) => <Component size={size} strokeWidth={2.1} {...props}/>

function Modal({title,onClose,children,wide=false}){
 useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose])
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className={'modal '+(wide?'modal-wide':'')} role="dialog" aria-modal="true" aria-label={title}>
   <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X size={20}/></button></div>
   <div className="modal-body">{children}</div>
  </section>
 </div>
}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function Input({label,...props}){return <Field label={label}><input {...props}/></Field>}
function SelectField({label,children,...props}){return <Field label={label}><select {...props}>{children}</select></Field>}
function TextArea({label,...props}){return <Field label={label}><textarea rows="2" {...props}/></Field>}
function FormButtons({busy,onCancel,label='Сохранить'}){return <div className="form-actions"><button type="button" className="btn btn-light" onClick={onCancel}>Отмена</button><button className="btn btn-primary" type="submit" disabled={busy}><Save size={17}/>{busy?'Сохраняю…':label}</button></div>}
function Status({item}){return <span className={'status status-'+item.key}>{item.key==='paid'?<Check size={14}/>:item.key==='partial'?<Clock size={14}/>:null}{item.label}</span>}
function ClientName({client}){return <div className="client-name"><div className="avatar">{initials(client.full_name)}</div><div><b>{client.full_name}</b><small>{client.district}{client.district&&client.settlement?', ':''}{client.settlement}</small></div></div>}
function Empty({text='Здесь пока нет записей'}){return <div className="empty"><Building2 size={32}/><p>{text}</p></div>}
function Card({children,className=''}){return <section className={'panel '+className}>{children}</section>}
function CardTitle({icon:Component,title,right}){return <div className="panel-title"><h3><Component size={23}/>{title}</h3>{right}</div>}
function MiniButton({children,onClick}){return <button className="text-action" onClick={onClick}>{children}<ChevronRight size={17}/></button>}
function MonthInput({month,setMonth}){return <label className="month-select"><CalendarDays size={18}/><input type="month" value={month.slice(0,7)} onChange={e=>e.target.value&&setMonth(e.target.value+'-01')}/></label>}
function WeekNav({day,onChange}){return <div className="week-nav"><button title="Прошлая неделя" onClick={()=>onChange(plusDays(day,-7))}><ChevronLeft size={18}/></button><span>{formatDate(weekStart(day))} — {formatDate(plusDays(weekStart(day),6))}</span><button title="Следующая неделя" onClick={()=>onChange(plusDays(day,7))}><ChevronRight size={18}/></button></div>}

function ClientForm({initial,onSubmit,onCancel,busy}){
 const [form,setForm]=useState(()=>({full_name:'',district:'',settlement:'',address:'',phone:'',area_m2:'',rate_per_m2:7,visits_per_month:4,preferred_days:'',notes:'',...initial}))
 const change=(key,v)=>setForm(f=>({...f,[key]:v}))
 return <form onSubmit={e=>{e.preventDefault();onSubmit(form)}}>
  <div className="form-grid"><Input label="Фамилия, имя, отчество *" required value={form.full_name} onChange={e=>change('full_name',e.target.value)}/>
   <Input label="Телефон" type="tel" value={form.phone} onChange={e=>change('phone',e.target.value)}/>
   <Input label="Район *" required value={form.district} onChange={e=>change('district',e.target.value)}/>
   <Input label="Населённый пункт *" required value={form.settlement} onChange={e=>change('settlement',e.target.value)}/>
   <Input label="Адрес / ориентир" value={form.address} onChange={e=>change('address',e.target.value)}/>
   <Input label="Удобные дни (например, среда)" value={form.preferred_days} onChange={e=>change('preferred_days',e.target.value)}/>
   <Input label="Площадь теплицы, м² *" type="number" required min="1" step="0.01" value={form.area_m2} onChange={e=>change('area_m2',e.target.value)}/>
   <Input label="Тариф, ₽/м² в месяц *" type="number" required min="0" step="0.01" value={form.rate_per_m2} onChange={e=>change('rate_per_m2',e.target.value)}/>
   <Input label="Визитов в месяц" type="number" required min="1" max="20" value={form.visits_per_month} onChange={e=>change('visits_per_month',e.target.value)}/>
  </div>
  <div className="calculated"><span>Начисление за месяц</span><strong>{money(Number(form.area_m2)*Number(form.rate_per_m2))}</strong><small>Один из {form.visits_per_month||4} визитов: {money(Number(form.area_m2)*Number(form.rate_per_m2)/Number(form.visits_per_month||4))}</small></div>
  <TextArea label="Примечание" value={form.notes} onChange={e=>change('notes',e.target.value)}/>
  {initial?.id&&<p className="help">Изменение тарифа влияет на новые месяцы. Уже созданные начисления сохраняют старые суммы.</p>}
  <FormButtons busy={busy} onCancel={onCancel}/>
 </form>
}
function PaymentForm({clients,charges,payments,month,initialClient,onSubmit,onCancel,busy}){
 const [clientId,setClientId]=useState(initialClient||'')
 const [chargeId,setChargeId]=useState('')
 const [amount,setAmount]=useState('')
 const [method,setMethod]=useState('cash')
 const [paidAt,setPaidAt]=useState(dateISO())
 const [note,setNote]=useState('')
 const unpaid=charges.filter(c=>c.client_id===clientId && isUnpaid(c,payments)).sort((a,b)=>String(b.billing_month).localeCompare(String(a.billing_month)))
 const current=unpaid.find(c=>c.id===chargeId)
 useEffect(()=>{setChargeId('');setAmount('')},[clientId])
 useEffect(()=>{if(unpaid.length&&!chargeId){setChargeId(unpaid[0].id);setAmount(outstanding(unpaid[0],payments).toFixed(2))}},[clientId,charges,payments,chargeId])
 return <form onSubmit={e=>{e.preventDefault();onSubmit({charge_id:chargeId,amount:Number(amount),method,paid_at:paidAt,note})}}>
  <SelectField label="Клиент *" required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Выберите клиента</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name} — {c.settlement}</option>)}</SelectField>
  <SelectField label="Какое начисление оплачивают *" required value={chargeId} onChange={e=>{setChargeId(e.target.value);let charge=unpaid.find(c=>c.id===e.target.value);setAmount(charge?outstanding(charge,payments).toFixed(2):'')}}>
   <option value="">Выберите начисление</option>{unpaid.map(c=><option value={c.id} key={c.id}>{c.type==='debt'?'Долг: ':'Месяц: '}{c.title||monthLabel(c.billing_month)} — остаток {money(outstanding(c,payments))}</option>)}
  </SelectField>
  {current&&<div className="pay-shortcuts"><p className="help">Остаток: <b>{money(outstanding(current,payments))}</b></p>{current.type==='monthly'&&<button type="button" className="btn btn-light" onClick={()=>{let n=clients.find(c=>c.id===clientId)?.visits_per_month||4;setAmount(Math.min(outstanding(current,payments),Math.round(Number(current.amount)/n*100)/100).toFixed(2))}}>Оплата за 1 визит — {money(Number(current.amount)/(clients.find(c=>c.id===clientId)?.visits_per_month||4))}</button>}<button type="button" className="btn btn-light" onClick={()=>setAmount(outstanding(current,payments).toFixed(2))}>Весь остаток</button></div>}
  {!unpaid.length&&clientId&&<p className="notice">У клиента нет неоплаченных начислений. Проверьте, создано ли начисление месяца.</p>}
  <div className="form-grid"><Input label="Получено, ₽ *" type="number" required min="0.01" max={current?outstanding(current,payments):undefined} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>
   <Input label="Дата получения" type="date" required value={paidAt} onChange={e=>setPaidAt(e.target.value)}/></div>
  <SelectField label="Способ оплаты" value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Наличные</option><option value="bank">Банковский перевод</option></SelectField>
  <TextArea label="Комментарий (необязательно)" value={note} onChange={e=>setNote(e.target.value)}/>
  <FormButtons busy={busy} onCancel={onCancel} label="Записать оплату"/>
 </form>
}
function DebtForm({clients,month,onSubmit,onCancel,busy}){
 const [clientId,setClientId]=useState(''),[amount,setAmount]=useState(''),[title,setTitle]=useState('Долг прошлого сезона')
 return <form onSubmit={e=>{e.preventDefault();onSubmit({client_id:clientId,type:'debt',billing_month:month,title,amount:Number(amount)})}}>
  <SelectField label="Клиент" required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Выберите клиента</option>{clients.map(c=><option value={c.id} key={c.id}>{c.full_name}</option>)}</SelectField>
  <Input label="Сумма долга, ₽" type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/>
  <Input label="За что долг" required value={title} onChange={e=>setTitle(e.target.value)}/>
  <p className="help">Этот долг учитывается отдельно от ежемесячного тарифа и может погашаться частями.</p>
  <FormButtons busy={busy} onCancel={onCancel} label="Добавить долг"/>
 </form>
}
function VisitForm({clients,initial,day,onSubmit,onCancel,busy}){
 const [f,setF]=useState(()=>({client_id:'',visit_date:day,start_time:'09:00',duration_minutes:20,status:'scheduled',consultation:false,notes:'',...initial}))
 const set=(k,v)=>setF(s=>({...s,[k]:v}))
 return <form onSubmit={e=>{e.preventDefault();onSubmit(f)}}>
  <SelectField label="Клиент *" required value={f.client_id} onChange={e=>set('client_id',e.target.value)}><option value="">Выберите клиента</option>{clients.filter(c=>c.active||c.id===f.client_id).map(c=><option key={c.id} value={c.id}>{c.full_name} — {c.district}, {c.settlement}</option>)}</SelectField>
  <div className="form-grid"><Input label="Дата визита *" type="date" required value={f.visit_date} onChange={e=>set('visit_date',e.target.value)}/>
   <Input label="Время *" type="time" required value={timeShort(f.start_time)} onChange={e=>set('start_time',e.target.value)}/>
   <Input label="Продолжительность, минут" type="number" min="5" max="300" value={f.duration_minutes} onChange={e=>set('duration_minutes',e.target.value)}/>
   <SelectField label="Состояние" value={f.status} onChange={e=>set('status',e.target.value)}><option value="scheduled">Запланирован</option><option value="completed">Проведён</option><option value="cancelled">Отменён</option></SelectField></div>
  <label className="check-row"><input type="checkbox" checked={Boolean(f.consultation)} onChange={e=>set('consultation',e.target.checked)}/> Консультация проведена</label>
  <TextArea label="Комментарий" value={f.notes} onChange={e=>set('notes',e.target.value)}/>
  <FormButtons busy={busy} onCancel={onCancel}/>
 </form>
}
function ExpenseForm({onSubmit,onCancel,busy}){
 const [f,setF]=useState({spent_at:dateISO(),amount:'',category:'Транспорт',note:''})
 const set=(k,v)=>setF(s=>({...s,[k]:v}))
 return <form onSubmit={e=>{e.preventDefault();onSubmit({...f,amount:Number(f.amount)})}}>
  <div className="form-grid"><Input label="Сумма расхода, ₽" required min="0.01" step="0.01" type="number" value={f.amount} onChange={e=>set('amount',e.target.value)}/><Input label="Дата" required type="date" value={f.spent_at} onChange={e=>set('spent_at',e.target.value)}/></div>
  <SelectField label="Категория" value={f.category} onChange={e=>set('category',e.target.value)}>{['Транспорт','Оплата труда','Материалы','Связь','Прочее'].map(v=><option key={v}>{v}</option>)}</SelectField>
  <TextArea label="Комментарий" value={f.note} onChange={e=>set('note',e.target.value)}/>
  <FormButtons busy={busy} onCancel={onCancel} label="Добавить расход"/>
 </form>
}

function Login({onLogin,busy,error}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState('')
 return <main className="auth-screen"><div className="auth-card">
  <div className="brand brand-big"><div className="brand-mark"><Sprout size={30}/></div><div><strong>AgroKontrol</strong><small>Финансы и обслуживание теплиц</small></div></div>
  <h1>Вход в систему</h1><p>Для администратора и агронома. Доступ только сотрудникам.</p>
  <form onSubmit={e=>{e.preventDefault();onLogin(email,password)}}>
   <Input label="Электронная почта" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
   <Input label="Пароль" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>
   {error&&<div className="error-box">{error}</div>}
   <button className="btn btn-primary btn-full" disabled={busy}>{busy?'Проверка…':'Войти в AgroKontrol'}</button>
  </form><p className="auth-footer"><LockKeyhole size={15}/> Регистрация закрыта. Учётные записи создаёт администратор базы.</p>
 </div></main>
}

export default function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null)
 const [data,setData]=useState(EMPTY),[page,setPage]=useState('dashboard')
 const [month,setMonth]=useState(monthISO(dateISO())),[day,setDay]=useState(dateISO())
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[toast,setToast]=useState('')
 const [modal,setModal]=useState(null),[drawer,setDrawer]=useState(false)
 const [search,setSearch]=useState(''),[districtFilter,setDistrictFilter]=useState('')
 const [selectedClient,setSelectedClient]=useState(null)
 const [reportYear,setReportYear]=useState(new Date().getFullYear())
 const [newPassword,setNewPassword]=useState('')
 useEffect(()=>{
  if(!configured) {setLoading(false);return}
  supabase.auth.getSession().then(({data,error})=>{if(error)setError(error.message);setSession(data?.session||null);setLoading(false)})
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s))
  return()=>subscription.unsubscribe()
 },[])
 useEffect(()=>{if(session?.user?.id) refresh();else setProfile(null)},[session?.user?.id])
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(id)},[toast])
 async function refresh(){
  const {data:userProfile,error:pErr}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle()
  if(pErr){setError(pErr.message);return}
  setProfile(userProfile||null)
  if(!userProfile){setData(EMPTY);return}
  const names=['clients','charges','payments','visits','expenses']
  const result=await Promise.all(names.map(t=>supabase.from(t).select('*').limit(10000)))
  const firstError=result.find(r=>r.error)?.error
  if(firstError){setError('Ошибка загрузки базы: '+errorMessage(firstError));return}
  setData(Object.fromEntries(names.map((name,i)=>[name,result[i].data||[]])))
  setError('')
 }
 const admin=profile?.role==='admin'
 const {clients,charges,payments,visits,expenses}=data
 const clientById=id=>clients.find(c=>c.id===id)
 const rows=useMemo(()=>clients.map(c=>({...c,paymentStatus:statusForClient(c,charges,payments,month)})),[clients,charges,payments,month])
 const activeRows=rows.filter(r=>r.active)
 const monthCharges=charges.filter(c=>c.type==='monthly'&&sameMonth(c.billing_month,month))
 const monthPayments=payments.filter(p=>sameMonth(p.paid_at,month))
 const monthExpenses=expenses.filter(e=>sameMonth(e.spent_at,month))
 const monthlyReceived=sum(monthPayments.map(p=>p.amount)),monthlyExpense=sum(monthExpenses.map(e=>e.amount))
 const expected=sum(monthCharges.map(c=>outstanding(c,payments)))
 const oldDebts=charges.filter(c=>c.type==='debt'||(c.type==='monthly'&&c.billing_month<month)).filter(c=>isUnpaid(c,payments))
 const totalDebt=sum(oldDebts.map(c=>outstanding(c,payments)))
 const paidCount=activeRows.filter(c=>c.paymentStatus.key==='paid').length
 const partialCount=activeRows.filter(c=>c.paymentStatus.key==='partial').length
 const unpaidCount=activeRows.filter(c=>c.paymentStatus.key==='unpaid').length
 const statusTotal=paidCount+partialCount+unpaidCount
 const totalArea=sum(activeRows.map(r=>r.area_m2))
 const cash=sum(monthPayments.filter(p=>p.method==='cash').map(p=>p.amount))
 const bank=sum(monthPayments.filter(p=>p.method==='bank').map(p=>p.amount))
 const dayVisits=visits.filter(v=>v.visit_date===day&&v.status!=='cancelled').sort((a,b)=>timeShort(a.start_time).localeCompare(timeShort(b.start_time)))
 const weekVisitList=visits.filter(v=>weekDays(day).includes(v.visit_date)&&v.status!=='cancelled')
 const selectedClientRow=selectedClient?rows.find(c=>c.id===selectedClient):null
 const debtsByClient=useMemo(()=>{
  const groups={};oldDebts.forEach(c=>groups[c.client_id]=(groups[c.client_id]||0)+outstanding(c,payments));return groups
 },[charges,payments,month])
 const weekBars=Array.from({length:5},(_,i)=>({label:`${i*7+1}–${Math.min(i*7+7,new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate())}`,value:sum(monthPayments.filter(p=>Math.floor((Number(p.paid_at.slice(8,10))-1)/7)===i).map(p=>p.amount))})).filter((x,i)=>i<4||x.label.split('–')[0]<=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate())
 const barMax=Math.max(1,...weekBars.map(b=>b.value))
 const statusPie=statusTotal?`conic-gradient(#0baa4a 0 ${paidCount/statusTotal*100}%,#ffc333 ${paidCount/statusTotal*100}% ${(paidCount+partialCount)/statusTotal*100}%,#f04444 ${(paidCount+partialCount)/statusTotal*100}% 100%)`:'conic-gradient(#e6edea 0 100%)'
 const go=p=>{setPage(p);setDrawer(false);setSearch('')}
 function showError(e){setError(errorMessage(e));setToast('Не удалось сохранить. Проверьте сообщение об ошибке.');window.scrollTo({top:0,behavior:'smooth'})}
 async function run(fn,success){setBusy(true);setError('');try{await fn();await refresh();setModal(null);setSelectedClient(null);setToast(success)}catch(e){showError(e)}finally{setBusy(false)}}
 async function write(table,obj,id){const req=id?supabase.from(table).update(obj).eq('id',id):supabase.from(table).insert(obj);const {error}=await req;if(error)throw error}
 async function signIn(email,password){setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('Не удалось войти: '+error.message);setBusy(false)}
 async function addClient(form){
  const obj={full_name:form.full_name.trim(),district:form.district.trim(),settlement:form.settlement.trim(),address:form.address||'',phone:form.phone||'',area_m2:Number(form.area_m2),rate_per_m2:Number(form.rate_per_m2),visits_per_month:Number(form.visits_per_month),preferred_days:form.preferred_days||'',notes:form.notes||''}
  if(!obj.full_name||!obj.district||!obj.settlement||!(obj.area_m2>0)||obj.rate_per_m2<0) throw Error('Заполните обязательные поля клиента')
  if(form.id){await write('clients',obj,form.id);return}
  const {data:created,error}=await supabase.from('clients').insert(obj).select('id').single();if(error)throw error
  if(obj.area_m2*obj.rate_per_m2>0){
   const {error:ce}=await supabase.from('charges').insert({client_id:created.id,type:'monthly',billing_month:month,title:monthLabel(month),amount:Math.round(obj.area_m2*obj.rate_per_m2*100)/100,area_snapshot:obj.area_m2,rate_snapshot:obj.rate_per_m2,created_by:session.user.id})
   if(ce)throw Error('Клиент добавлен, но начисление не создано: '+ce.message)
  }
 }
 async function generateMonth(){
  const missing=clients.filter(c=>c.active&&Number(c.area_m2)*Number(c.rate_per_m2)>0&&!charges.some(x=>x.client_id===c.id&&x.type==='monthly'&&sameMonth(x.billing_month,month)))
  if(!missing.length){setToast('Начисления за месяц уже созданы');return}
  if(!window.confirm(`Создать начисления за ${monthLabel(month)} для ${missing.length} клиентов?`))return
  await run(async()=>{const payload=missing.map(c=>({client_id:c.id,type:'monthly',billing_month:month,title:monthLabel(month),amount:Math.round(Number(c.area_m2)*Number(c.rate_per_m2)*100)/100,area_snapshot:c.area_m2,rate_snapshot:c.rate_per_m2,created_by:session.user.id}));const {error}=await supabase.from('charges').insert(payload);if(error)throw error},`Создано начислений: ${missing.length}`)
 }
 function paidForVisit(v){
  const c=clientById(v.client_id);if(!c)return false
  const charge=charges.find(x=>x.client_id===c.id&&x.type==='monthly'&&sameMonth(x.billing_month,v.visit_date));if(!charge)return false
  const related=visits.filter(x=>x.client_id===c.id&&sameMonth(x.visit_date,v.visit_date)&&x.status!=='cancelled').sort((a,b)=>`${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`))
  const index=related.findIndex(x=>x.id===v.id)+1
  return chargePaid(charge,payments)+0.009>=Number(charge.amount)*Math.max(1,index)/Math.max(1,Number(c.visits_per_month||4))
 }
 async function saveVisit(form){
  const obj={client_id:form.client_id,visit_date:form.visit_date,start_time:timeShort(form.start_time),duration_minutes:Number(form.duration_minutes),status:form.status,consultation:Boolean(form.consultation),notes:form.notes||''}
  if(!obj.client_id)throw Error('Выберите клиента')
  const collision=visits.find(x=>x.id!==form.id&&x.visit_date===obj.visit_date&&x.status!=='cancelled'&&obj.status!=='cancelled'&&((Number(timeShort(obj.start_time).slice(0,2))*60+Number(timeShort(obj.start_time).slice(3,5)))<(Number(timeShort(x.start_time).slice(0,2))*60+Number(timeShort(x.start_time).slice(3,5))+Number(x.duration_minutes)))&&((Number(timeShort(x.start_time).slice(0,2))*60+Number(timeShort(x.start_time).slice(3,5)))<(Number(timeShort(obj.start_time).slice(0,2))*60+Number(timeShort(obj.start_time).slice(3,5))+Number(obj.duration_minutes))))
  if(collision&&!window.confirm('Это время пересекается с другим визитом. Сохранить всё равно?'))return
  const c=clientById(obj.client_id)
  if(!form.id&&obj.status!=='cancelled'){
    const monthCharge=charges.find(x=>x.client_id===obj.client_id&&x.type==='monthly'&&sameMonth(x.billing_month,obj.visit_date))
    const count=visits.filter(x=>x.client_id===obj.client_id&&sameMonth(x.visit_date,obj.visit_date)&&x.status!=='cancelled').length+1
    const covered=monthCharge&&chargePaid(monthCharge,payments)+0.009>=Number(monthCharge.amount)*count/Number(c?.visits_per_month||4)
    if(!covered&&!window.confirm('Оплата не покрывает этот визит. Всё равно запланировать?'))return
  }
  await write('visits',obj,form.id)
 }
 async function planPaidWeek(){
   // На выбранной неделе планируем не больше одного визита на клиента.
   // Каждый уже назначенный визит месяца занимает одну из оплаченных долей.
   const days=weekDays(day)
   const candidates=[]
   const preferred=[['понедельник','пн'],['вторник','вт'],['среда','ср'],['четверг','чт'],['пятница','пт'],['суббота','сб'],['воскресенье','вс']]
   const districtDay={}
   const districts=[...new Set(clients.filter(c=>c.active).map(c=>c.district))].sort()
   districts.forEach((district,index)=>{
     const prefs=clients.filter(c=>c.active&&c.district===district).flatMap(c=>preferred.map((a,i)=>a.some(t=>String(c.preferred_days||'').toLowerCase().includes(t))?i:-1)).filter(i=>i>=0)
     districtDay[district]=prefs.length?prefs.sort((a,b)=>prefs.filter(x=>x===b).length-prefs.filter(x=>x===a).length)[0]:index%5
   })
   for(const c of clients.filter(c=>c.active).sort((a,b)=>(a.district+' '+a.settlement+' '+a.full_name).localeCompare(b.district+' '+b.settlement+' '+b.full_name))){
     const alreadyWeek=visits.some(v=>v.client_id===c.id&&days.includes(v.visit_date)&&v.status!=='cancelled')
     if(alreadyWeek)continue
     const preferredDay=preferred.findIndex(parts=>parts.some(t=>String(c.preferred_days||'').toLowerCase().includes(t)))
     const idx=preferredDay>=0?preferredDay:districtDay[c.district]||0
     const visitDate=days[idx]
     const ch=charges.find(x=>x.client_id===c.id&&x.type==='monthly'&&sameMonth(x.billing_month,visitDate))
     if(!ch)continue
     const eligible=Math.min(Number(c.visits_per_month),Math.floor(chargePaid(ch,payments)*Number(c.visits_per_month)/Number(ch.amount)+0.00001))
     const alreadyMonth=visits.filter(v=>v.client_id===c.id&&sameMonth(v.visit_date,visitDate)&&v.status!=='cancelled').length
     if(eligible>alreadyMonth)candidates.push({client:c,visitDate})
   }
   if(!candidates.length){setToast('Нет клиентов с оплаченными, но не назначенными визитами на эту неделю');return}
   const used=visits.filter(v=>days.includes(v.visit_date)&&v.status!=='cancelled').map(v=>({date:v.visit_date,from:Number(timeShort(v.start_time).slice(0,2))*60+Number(timeShort(v.start_time).slice(3,5)),to:Number(timeShort(v.start_time).slice(0,2))*60+Number(timeShort(v.start_time).slice(3,5))+Number(v.duration_minutes)}))
   const created=[]
   for(const {client:c,visitDate} of candidates){
      let from=8*60+30
      while(used.some(u=>u.date===visitDate&&from<u.to+10&&from+20>u.from-10)&&from<19*60)from+=30
      if(from>19*60)continue
      used.push({date:visitDate,from,to:from+20})
      created.push({client_id:c.id,visit_date:visitDate,start_time:`${String(Math.floor(from/60)).padStart(2,'0')}:${String(from%60).padStart(2,'0')}`,duration_minutes:20,status:'scheduled',consultation:false,notes:'Сформировано автоматически',created_by:session.user.id})
   }
   if(!created.length){setToast('На выбранной неделе нет свободных промежутков до 19:00');return}
   if(!window.confirm(`Сформировать ${created.length} визитов на неделю ${formatDate(days[0])} — ${formatDate(days[6])}? Дни выбраны по предпочтениям и районам, интервалы по 30 минут. Проверьте маршрут и время после создания.`))return
   await run(async()=>{const {error}=await supabase.from('visits').insert(created);if(error)throw error},`Запланировано визитов: ${created.length}`)
 }
 function exportJSON(){download(`AgroKontrol_backup_${dateISO()}.json`,JSON.stringify({exported_at:new Date().toISOString(),version:'1.0.0',clients,charges,payments,visits,expenses},null,2));setToast('JSON-копия загружена на устройство')}
 function exportCSV(){const records=[['Дата','Клиент','Тип начисления','Способ','Сумма','Комментарий'],...payments.slice().sort((a,b)=>b.paid_at.localeCompare(a.paid_at)).map(p=>{const charge=paymentCharge(p,charges);return[p.paid_at,clientById(charge?.client_id)?.full_name||'—',charge?.type==='debt'?'Долг':'Месяц',p.method==='cash'?'Наличные':'Перевод',p.amount,p.note]})];download(`AgroKontrol_payments_${dateISO()}.csv`,csv(records),'text/csv;charset=utf-8')}
 const nav= <nav>{NAV.map(([key,label,Comp])=><button key={key} className={'nav-item '+(page===key?'active':'')} onClick={()=>go(key)}><Comp size={19}/><span>{label}</span></button>)}</nav>
 const addButton=(label,cb)=><button className="btn btn-primary" onClick={cb}><Plus size={18}/>{label}</button>
 const openClient=c=>setSelectedClient(c.id)
 function clientTable(list,limit=Infinity){const shown=list.slice(0,limit);return shown.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Клиент</th><th>Площадь</th><th>Тариф</th><th>Сумма/мес.</th><th>Оплачено</th><th>Остаток</th><th>Статус</th><th></th></tr></thead><tbody>{shown.map(c=><tr key={c.id} className="clickable" onClick={()=>openClient(c)}><td><ClientName client={c}/></td><td>{nfmt(c.area_m2)} м²</td><td>{nfmt(c.rate_per_m2)} ₽/м²</td><td><b>{money(c.area_m2*c.rate_per_m2)}</b></td><td className="positive">{money(c.paymentStatus.paid)}</td><td className={c.paymentStatus.left?'negative':''}>{money(c.paymentStatus.left)}</td><td><Status item={c.paymentStatus}/></td><td><ChevronRight size={17}/></td></tr>)}</tbody></table></div>:<Empty text="Клиентов пока нет. Добавьте первого клиента."/>}
 function visitList(items){return items.length?<div className="visits-list">{items.map(v=>{const c=clientById(v.client_id);const eligible=paidForVisit(v);return <div className="visit-item" key={v.id}>
    <span className="visit-time">{timeShort(v.start_time)}</span><div className="visit-name"><b>{c?.full_name||'Клиент не найден'}</b><small><MapPin size={12}/>{c?.settlement||'—'} · {nfmt(c?.area_m2||0)} м²</small></div>
    <span className={'status status-'+(eligible?'paid':'unpaid')}>{eligible?'Оплата есть':'Проверить оплату'}</span>
    <span className={'visit-state '+v.status}>{v.status==='completed'?'Проведён':v.status==='cancelled'?'Отменён':'План'}</span>
    <button className="icon-btn" title="Редактировать визит" onClick={()=>setModal({type:'visit',initial:v})}><Edit3 size={16}/></button>
   </div>})}</div>:<Empty text="На выбранный день визиты не запланированы"/>}
 function statsCards(){return <div className="stats-grid">
  <div className="stat-card success"><Coins/><div>Поступило <small>(месяц)</small></div><strong>{money(monthlyReceived)}</strong><small>Наличные и переводы</small></div>
  <div className="stat-card soft"><CalendarCheck/><div>Ожидается к оплате</div><strong>{money(expected)}</strong><small>За выбранный месяц</small></div>
  <div className="stat-card danger"><AlertTriangle/><div>Задолженность</div><strong>{money(totalDebt)}</strong><small>Старые долги и прошлые месяцы</small></div>
  <div className="stat-card success"><TrendingUp/><div>Оплачено клиентов</div><strong>{statusTotal?Math.round(paidCount/statusTotal*1000)/10:0}%</strong><small>{paidCount} из {statusTotal} с начислением</small></div>
  <div className="stat-card soft"><Building2/><div>Общая площадь</div><strong>{nfmt(totalArea)} м²</strong><small>{activeRows.length} активных клиентов</small></div>
 </div>}
 function moneyCard(){return <Card><CardTitle icon={Coins} title="Движение денег" right={<span className="small-tag">{monthLabel(month)}</span>}/><div className="money-lines">
 <div><span><Wallet size={18}/>Поступления</span><b className="positive">{money(monthlyReceived)}</b></div>
 <div className="subline"><span><Banknote size={16}/>Наличные</span>{money(cash)}</div><div className="subline"><span><CreditCard size={16}/>Банковские переводы</span>{money(bank)}</div>
 <div><span><Receipt size={18}/>Расходы</span><b className="negative">− {money(monthlyExpense)}</b></div>
 <div className="net-line"><span><TrendingUp size={18}/>Чистый денежный поток</span><b>{money(monthlyReceived-monthlyExpense)}</b></div>
 </div></Card>}
 function chartCard(){return <Card><CardTitle icon={BarChart3} title="Поступления по неделям"/><div className="bars">{weekBars.map((b,i)=><div className="bar-slot" key={i}><div className="bar-value">{nfmt(b.value)}</div><div className="bar" style={{height:`${Math.max(4,b.value/barMax*160)}px`}} title={money(b.value)}></div><small>{i+1} неделя</small></div>)}</div><p className="help center">Поступления по датам фактической оплаты за {monthLabel(month)}</p></Card>}
 function donutCard(){return <Card><CardTitle icon={TrendingUp} title="Статус оплат (клиенты)"/><div className="donut-wrap"><div className="donut" style={{background:statusPie}}><div><b>{statusTotal}</b><small>клиентов</small></div></div><div className="legend"><div><i className="dot green"/>Оплачено <b>{paidCount}</b></div><div><i className="dot yellow"/>Частично <b>{partialCount}</b></div><div><i className="dot red"/>Не оплачено <b>{unpaidCount}</b></div><small>Без начисления: {activeRows.length-statusTotal}</small></div></div></Card>}
 function dayStrip(){return <div className="day-strip">{weekDays(day).map((d,i)=><button key={d} className={'day-tab '+(day===d?'selected':'')} onClick={()=>setDay(d)}><b>{ruDays[i]}</b><span>{formatDate(d,{day:'numeric',month:'short'})}</span><small>{visits.filter(v=>v.visit_date===d&&v.status!=='cancelled').length} виз.</small></button>)}</div>}
 function dashboard(){return <>{statsCards()}<div className="three-col">{moneyCard()}{chartCard()}{donutCard()}</div><div className="two-col"><Card><CardTitle icon={Users} title="Клиенты и оплаты" right={<MiniButton onClick={()=>go('clients')}>Все клиенты</MiniButton>}/>{clientTable(activeRows,5)}</Card><Card><CardTitle icon={CalendarDays} title="План визитов" right={<MiniButton onClick={()=>go('visits')}>Весь календарь</MiniButton>}/><WeekNav day={day} onChange={setDay}/>{dayStrip()}<p className="subheading">{formatDate(day,{weekday:'long',day:'numeric',month:'long'})} — {dayVisits.length} визитов</p>{visitList(dayVisits)}</Card></div></>}
 function clientsPage(){let filtered=activeRows.filter(c=>[c.full_name,c.district,c.settlement,c.phone].join(' ').toLowerCase().includes(search.toLowerCase())&&(!districtFilter||c.district===districtFilter));return <Card><CardTitle icon={Users} title="База клиентов" right={admin&&addButton('Добавить клиента',()=>setModal({type:'client'}))}/><div className="filters"><label className="search"><Search size={17}/><input placeholder="Поиск по ФИО, району, посёлку, телефону" value={search} onChange={e=>setSearch(e.target.value)}/></label><select value={districtFilter} onChange={e=>setDistrictFilter(e.target.value)}><option value="">Все районы</option>{[...new Set(clients.map(c=>c.district).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select></div><p className="help">Показано: {filtered.length} из {activeRows.length}. Суммы и статусы — за {monthLabel(month)}.</p>{clientTable(filtered)}</Card>}
 function paymentsPage(){const list=payments.filter(p=>sameMonth(p.paid_at,month)).sort((a,b)=>b.paid_at.localeCompare(a.paid_at));return <><div className="mini-kpis"><div><span>Поступило</span><b>{money(monthlyReceived)}</b></div><div><span>Наличными</span><b>{money(cash)}</b></div><div><span>Переводами</span><b>{money(bank)}</b></div><div><span>Расходы</span><b>{money(monthlyExpense)}</b></div></div><div className="two-col"><Card><CardTitle icon={Wallet} title="Журнал поступлений" right={admin&&addButton('Внести оплату',()=>setModal({type:'payment'}))}/><div className="table-scroll"><table className="data-table"><thead><tr><th>Дата</th><th>Клиент</th><th>За что</th><th>Способ</th><th>Сумма</th>{admin&&<th></th>}</tr></thead><tbody>{list.map(p=>{const ch=paymentCharge(p,charges);return <tr key={p.id}><td>{formatDate(p.paid_at)}</td><td>{clientById(ch?.client_id)?.full_name||'—'}</td><td>{ch?.type==='debt'?'Долг':monthLabel(ch?.billing_month||month)}</td><td>{p.method==='cash'?'Наличные':'Перевод'}</td><td className="positive"><b>{money(p.amount)}</b></td>{admin&&<td><button className="icon-btn" title="Удалить ошибочную запись (с аудитом)" onClick={()=>{if(window.confirm('Удалить эту запись оплаты? Действие попадёт в журнал аудита.'))run(async()=>{const {error}=await supabase.from('payments').delete().eq('id',p.id);if(error)throw error},'Оплата удалена')}}><Trash2 size={15}/></button></td>}</tr>})}</tbody></table></div>{!list.length&&<Empty text="В этом месяце поступлений нет"/>}</Card><Card><CardTitle icon={Receipt} title="Расходы" right={admin&&addButton('Добавить расход',()=>setModal({type:'expense'}))}/><div className="small-list">{monthExpenses.map(e=><div key={e.id} className="line-item"><div><b>{e.category}</b><small>{formatDate(e.spent_at)} · {e.note}</small></div><strong className="negative">− {money(e.amount)}</strong></div>)}{!monthExpenses.length&&<Empty text="Расходов за месяц нет"/>}</div><div className="highlight-line">Чистый денежный поток <b>{money(monthlyReceived-monthlyExpense)}</b></div></Card></div></>}
 function debtsPage(){const items=Object.entries(debtsByClient).filter(([_,v])=>v>0).sort((a,b)=>b[1]-a[1]);return <Card><CardTitle icon={AlertTriangle} title="Задолженности" right={admin&&addButton('Добавить старый долг',()=>setModal({type:'debt'}))}/><div className="callout"><AlertTriangle size={20}/><div><b>Непогашенная задолженность: {money(totalDebt)}</b><small>Сумма долгов прошлых сезонов и не оплаченных полностью прошлых месяцев. Текущий месяц показан отдельно на главной.</small></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Клиент</th><th>Задолженность</th><th>Район</th><th>Действие</th></tr></thead><tbody>{items.map(([id,total])=><tr key={id}><td>{clientById(id)?.full_name||'—'}</td><td className="negative"><b>{money(total)}</b></td><td>{clientById(id)?.district||'—'}</td><td><button className="text-action" onClick={()=>admin?setModal({type:'payment',clientId:id}):openClient(clientById(id))}>{admin?'Внести оплату':'Посмотреть'}<ChevronRight size={15}/></button></td></tr>)}</tbody></table></div>{!items.length&&<Empty text="Старых задолженностей нет"/>}</Card>}
 function visitsPage(){return <Card><CardTitle icon={CalendarDays} title="Календарь визитов" right={addButton('Назначить визит',()=>setModal({type:'visit'}))}/><div className="planning-bar"><span>Оплаченные клиенты → план недели</span><button className="btn btn-light" onClick={planPaidWeek}><CalendarCheck size={17}/>Сформировать автоматически</button></div><div className="calendar-controls"><WeekNav day={day} onChange={setDay}/><button className="btn btn-light" onClick={()=>setDay(dateISO())}>Сегодня</button></div>{dayStrip()}<p className="subheading">{formatDate(day,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {dayVisits.length} визитов · {sum(dayVisits.map(v=>v.duration_minutes))} мин</p>{visitList(dayVisits)}<p className="help">Зелёная отметка означает, что оплаченная часть месячного начисления покрывает этот по счёту визит. Визит без оплаты можно назначить вручную с предупреждением.</p></Card>}
 function routesPage(){const districts={};dayVisits.forEach(v=>{const c=clientById(v.client_id),district=c?.district||'Не указан';(districts[district]||=[]).push({visit:v,client:c})});return <Card><CardTitle icon={MapPin} title="Маршруты по районам" right={addButton('Добавить визит',()=>setModal({type:'visit'}))}/><div className="calendar-controls"><WeekNav day={day} onChange={setDay}/><button className="btn btn-light" onClick={()=>setDay(dateISO())}>Сегодня</button></div>{dayStrip()}<p className="help">Группировка визитов по району и населённому пункту. Это список остановок, а не расчёт дорожного маршрута по карте.</p>{Object.entries(districts).map(([district,items])=><div className="route-group" key={district}><h3><MapPin size={19}/>{district}<span>{items.length} визитов</span></h3>{items.slice().sort((a,b)=>(a.client?.settlement||'').localeCompare(b.client?.settlement||'')).map(({visit:v,client:c},i)=><div className="route-stop" key={v.id}><b className="stop-number">{i+1}</b><div><b>{c?.full_name||'—'}</b><small>{c?.settlement||'—'} · {c?.address||'адрес не указан'}</small></div><span>{timeShort(v.start_time)}</span></div>)}</div>)}{!Object.keys(districts).length&&<Empty text="Для маршрута сначала назначьте визиты"/>}</Card>}
 function districtsPage(){const groups={};activeRows.forEach(c=>{const d=c.district||'Без района';const place=c.settlement||'Без населённого пункта';if(!groups[d])groups[d]={};(groups[d][place]||=[]).push(c)});return <Card><CardTitle icon={Map} title="Районы и населённые пункты"/><div className="district-grid">{Object.entries(groups).sort().map(([district,places])=><div className="district-box" key={district}><h3><MapPin size={18}/>{district}</h3>{Object.entries(places).sort().map(([name,clients])=><div key={name} className="line-item"><span>{name}</span><b>{clients.length} клиентов · {nfmt(sum(clients.map(c=>c.area_m2)))} м²</b></div>)}</div>)}</div>{!Object.keys(groups).length&&<Empty/>}</Card>}
 function reportsPage(){const yearly=Array.from({length:12},(_,i)=>{const m=`${reportYear}-${String(i+1).padStart(2,'0')}`;return {m,received:sum(payments.filter(p=>sameMonth(p.paid_at,m)).map(p=>p.amount)),expenses:sum(expenses.filter(e=>sameMonth(e.spent_at,m)).map(e=>e.amount)),invoiced:sum(charges.filter(c=>c.type==='monthly'&&sameMonth(c.billing_month,m)).map(c=>c.amount))}});return <><div className="heading-inline"><h2>Отчёты за {reportYear} год</h2><select value={reportYear} onChange={e=>setReportYear(Number(e.target.value))}>{Array.from({length:7},(_,i)=>new Date().getFullYear()+2-i).map(y=><option key={y}>{y}</option>)}</select></div><div className="mini-kpis"><div><span>Поступления за год</span><b>{money(sum(yearly.map(x=>x.received)))}</b></div><div><span>Расходы за год</span><b>{money(sum(yearly.map(x=>x.expenses)))}</b></div><div><span>Чистый денежный поток</span><b>{money(sum(yearly.map(x=>x.received-x.expenses)))}</b></div></div><Card><CardTitle icon={BarChart3} title="Помесячная отчётность" right={<button className="btn btn-light" onClick={exportCSV}><FileDown size={17}/>CSV оплат</button>}/><div className="table-scroll"><table className="data-table"><thead><tr><th>Месяц</th><th>Начислено</th><th>Получено</th><th>Расходы</th><th>Денежный поток</th></tr></thead><tbody>{yearly.map(r=><tr key={r.m}><td>{monthLabel(r.m)}</td><td>{money(r.invoiced)}</td><td className="positive">{money(r.received)}</td><td>{money(r.expenses)}</td><td><b>{money(r.received-r.expenses)}</b></td></tr>)}</tbody></table></div></Card></>}
 function tariffsPage(){return <Card><CardTitle icon={Tag} title="Тарифы и площади" right={admin&&<MiniButton onClick={()=>go('clients')}>Управление клиентами</MiniButton>}/><p className="help">Тариф указывается индивидуально в ₽ за 1 м² в месяц. Начисление = площадь × тариф, затем сумма делится на число визитов в месяц.</p>{clientTable(activeRows)}</Card>}
 function consultationsPage(){const list=visits.filter(v=>v.consultation).sort((a,b)=>b.visit_date.localeCompare(a.visit_date));return <Card><CardTitle icon={MessageSquare} title="Консультации"/><p className="help">Отмечается только факт консультации. Подробный отчёт вводить не нужно.</p>{list.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Дата</th><th>Клиент</th><th>Район</th><th>Статус визита</th></tr></thead><tbody>{list.map(v=><tr key={v.id}><td>{formatDate(v.visit_date)}</td><td>{clientById(v.client_id)?.full_name||'—'}</td><td>{clientById(v.client_id)?.district||'—'}</td><td>{v.status==='completed'?'Проведён':'Запланирован'}</td></tr>)}</tbody></table></div>:<Empty text="Консультаций пока не отмечено"/>}</Card>}
 function archivePage(){return <Card><CardTitle icon={Archive} title="Архив клиентов"/><p className="help">Архивные клиенты не получают новых начислений, но история оплат и визитов сохраняется.</p>{rows.filter(c=>!c.active).map(c=><div className="line-item" key={c.id}><ClientName client={c}/>{admin&&<button className="btn btn-light" onClick={()=>run(()=>write('clients',{active:true},c.id),'Клиент возвращён из архива')}>Восстановить</button>}</div>)}{!rows.some(c=>!c.active)&&<Empty text="Архив пуст"/>}</Card>}
 function backupPage(){return <Card><CardTitle icon={Download} title="Экспорт и резервные копии"/><p>Здесь можно скачать данные на устройство. Экспорт содержит персональные и финансовые сведения — храните файл в безопасном месте.</p><div className="download-grid"><button className="download-tile" onClick={exportJSON}><Download size={28}/><b>Полная копия в JSON</b><small>Клиенты, начисления, оплаты, расходы, визиты</small></button><button className="download-tile" onClick={exportCSV}><FileDown size={28}/><b>Журнал оплат в CSV</b><small>Открывается в Excel и других таблицах</small></button></div><div className="notice">Это ручной экспорт, а не автоматическое серверное резервное копирование. Для восстановления через импорт и автоматических резервных копий потребуется отдельная функция или план резервного копирования Supabase.</div></Card>}
 async function passwordChange(){if(newPassword.length<10){setError('Пароль должен содержать не менее 10 символов');return}await run(async()=>{const {error}=await supabase.auth.updateUser({password:newPassword});if(error)throw error;setNewPassword('')},'Пароль изменён')}
 function settingsPage(){return <div className="two-col"><Card><CardTitle icon={UserRound} title="Профиль"/><div className="settings-lines"><div><span>Сотрудник</span><b>{profile.display_name}</b></div><div><span>Роль</span><b>{admin?'Администратор':'Агроном'}</b></div><div><span>Почта</span><b>{session.user.email}</b></div><div><span>Доступ</span><b>{admin?'Финансы: запись и изменение':'Финансы: только просмотр'}</b></div></div><button className="btn btn-light" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/>Выйти</button></Card><Card><CardTitle icon={ShieldCheck} title="Безопасность"/><p className="help">Измените пароль. Для этого необходимо войти в аккаунт.</p><Input label="Новый пароль (от 10 символов)" type="password" autoComplete="new-password" minLength="10" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><button className="btn btn-primary" onClick={passwordChange} disabled={busy||newPassword.length<10}>Обновить пароль</button><p className="help">Создание сотрудников и назначение ролей выполняется в Supabase Authentication и таблице profiles.</p></Card></div>}
 function clientDetail(){const c=selectedClientRow;if(!c)return null;const paid=payments.filter(p=>charges.some(ch=>ch.id===p.charge_id&&ch.client_id===c.id)).sort((a,b)=>b.paid_at.localeCompare(a.paid_at));const clientCharges=charges.filter(ch=>ch.client_id===c.id).sort((a,b)=>b.billing_month.localeCompare(a.billing_month));return <Modal title="Карточка клиента" onClose={()=>setSelectedClient(null)} wide><div className="detail-top"><ClientName client={c}/><Status item={c.paymentStatus}/></div><div className="detail-stats"><div><span>Площадь</span><b>{nfmt(c.area_m2)} м²</b></div><div><span>Тариф</span><b>{money(c.rate_per_m2)}/м²</b></div><div><span>Сумма в месяц</span><b>{money(c.area_m2*c.rate_per_m2)}</b></div><div><span>Остаток за месяц</span><b className="negative">{money(c.paymentStatus.left)}</b></div></div><p className="help">{c.district}, {c.settlement}, {c.address||'адрес не указан'} · {c.phone||'телефон не указан'} · {c.visits_per_month} визитов/месяц</p><p className="help">Удобные дни: {c.preferred_days||'не указаны'}. {c.notes}</p><h3>Начисления</h3>{clientCharges.length?<div className="small-list">{clientCharges.map(ch=><div className="line-item" key={ch.id}><div><b>{ch.type==='debt'?'Долг: '+ch.title:monthLabel(ch.billing_month)}</b><small>Начислено {money(ch.amount)}</small></div><strong className={outstanding(ch,payments)?'negative':'positive'}>Остаток {money(outstanding(ch,payments))}</strong></div>)}</div>:<Empty text="Начислений нет"/>}<h3>Последние оплаты</h3>{paid.slice(0,8).map(p=><div className="line-item" key={p.id}><span>{formatDate(p.paid_at)} · {p.method==='cash'?'Наличные':'Перевод'}</span><b className="positive">{money(p.amount)}</b></div>)}{!paid.length&&<p className="help">Оплат пока нет</p>}<div className="form-actions detail-actions">{admin&&<><button className="btn btn-light" onClick={()=>{setSelectedClient(null);setModal({type:'client',initial:c})}}><Edit3 size={17}/>Редактировать</button><button className="btn btn-primary" onClick={()=>{setSelectedClient(null);setModal({type:'payment',clientId:c.id})}}><Coins size={17}/>Внести оплату</button><button className="btn btn-light" onClick={()=>{if(window.confirm('Переместить клиента в архив? История сохранится.'))run(()=>write('clients',{active:!c.active},c.id),c.active?'Клиент в архиве':'Клиент восстановлен')}}>{c.active?'В архив':'Восстановить'}</button></>}</div></Modal>}
 const modalNode=modal&&<Modal title={{client:modal.initial?'Редактировать клиента':'Новый клиент',payment:'Внести оплату',debt:'Долг прошлого сезона',visit:modal.initial?'Редактировать визит':'Новый визит',expense:'Добавить расход'}[modal.type]} onClose={()=>setModal(null)} wide={modal.type==='client'}>
  {modal.type==='client'&&<ClientForm initial={modal.initial} onCancel={()=>setModal(null)} busy={busy} onSubmit={v=>run(()=>addClient(v),'Клиент сохранён')}/>}
  {modal.type==='payment'&&<PaymentForm clients={clients} charges={charges} payments={payments} month={month} initialClient={modal.clientId} onCancel={()=>setModal(null)} busy={busy} onSubmit={v=>run(()=>write('payments',{...v,recorded_by:session.user.id}),'Оплата записана')}/>}
  {modal.type==='debt'&&<DebtForm clients={clients} month={month} onCancel={()=>setModal(null)} busy={busy} onSubmit={v=>run(()=>write('charges',{...v,created_by:session.user.id}),'Долг добавлен')}/>}
  {modal.type==='visit'&&<VisitForm clients={clients} initial={modal.initial} day={day} onCancel={()=>setModal(null)} busy={busy} onSubmit={v=>run(()=>saveVisit(v),'Визит сохранён')}/>}
  {modal.type==='expense'&&<ExpenseForm busy={busy} onCancel={()=>setModal(null)} onSubmit={v=>run(()=>write('expenses',{...v,recorded_by:session.user.id}),'Расход записан')}/>}
 </Modal>
 if(!configured)return <div className="setup-screen"><Sprout size={42}/><h1>AgroKontrol готов к подключению</h1><p>Укажите адрес проекта и публичный ключ Supabase в переменных окружения <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, затем выполните SQL-файл.</p><p>Пошаговая инструкция — в <b>README.md</b>.</p></div>
 if(loading)return <div className="loading-screen"><Sprout size={44}/>Загрузка AgroKontrol…</div>
 if(!session)return <Login onLogin={signIn} busy={busy} error={error}/>
 if(!profile)return <div className="setup-screen"><ShieldCheck size={42}/><h1>Ожидается назначение роли</h1><p>Аккаунт <b>{session.user.email}</b> существует, но не добавлен в <code>public.profiles</code>. Администратор должен назначить роль через SQL из README.</p><button className="btn btn-light" onClick={()=>supabase.auth.signOut()}>Выйти</button></div>
 return <div className="app-shell">
  <aside className={'sidebar '+(drawer?'sidebar-open':'')}><div className="sidebar-head"><div className="brand"><div className="brand-mark"><Sprout size={26}/></div><div><strong>AgroKontrol</strong><small>Учёт клиентов • Оплаты • Визиты</small></div></div><button className="sidebar-close" onClick={()=>setDrawer(false)}><X/></button></div>{nav}<div className="sidebar-user"><div className="avatar dark">{initials(profile.display_name)}</div><div><b>{profile.display_name}</b><small>{admin?'Администратор':'Агроном'}</small></div></div></aside>
  {drawer&&<div className="drawer-shade" onClick={()=>setDrawer(false)}/>}
  <main className="main"><header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setDrawer(true)}><Menu/></button><div className="topbar-title"><h1>{page==='dashboard'?'Финансы и обслуживание теплиц':NAV.find(n=>n[0]===page)?.[1]}</h1><span>Клиенты · Платежи · План визитов · Маршруты</span></div><div className="topbar-controls"><MonthInput month={month} setMonth={setMonth}/><button className="icon-btn" title="Обновить данные" onClick={refresh}><RefreshCw size={20}/></button><button className="icon-btn user-icon" onClick={()=>go('settings')} title="Мой профиль"><UserRound size={21}/></button></div></header>
  <div className="content">{error&&<div className="error-banner"><AlertCircle size={19}/><span>{error}</span><button className="icon-btn" onClick={()=>setError('')}><X size={16}/></button></div>}
   {page==='dashboard'&&<>{admin&&<div className="toolbar"><div><b>{monthLabel(month)}</b><span>Начислено {money(sum(monthCharges.map(c=>c.amount)))}</span></div><div className="toolbar-actions"><button className="btn btn-light" onClick={generateMonth}><CalendarCheck size={17}/>Начислить месяц</button>{addButton('Внести оплату',()=>setModal({type:'payment'}))}</div></div>}{dashboard()}</>}
   {page==='clients'&&<>{admin&&<div className="toolbar"><span>Создавайте начисления в начале месяца для всех клиентов</span><button className="btn btn-light" onClick={generateMonth}><CalendarCheck size={17}/>Начислить {monthLabel(month)}</button></div>}{clientsPage()}</>}
   {page==='payments'&&paymentsPage()}{page==='debts'&&debtsPage()}{page==='visits'&&visitsPage()}{page==='routes'&&routesPage()}{page==='districts'&&districtsPage()}{page==='reports'&&reportsPage()}{page==='tariffs'&&tariffsPage()}{page==='seasons'&&reportsPage()}{page==='consultations'&&consultationsPage()}{page==='archive'&&archivePage()}{page==='backups'&&backupPage()}{page==='settings'&&settingsPage()}
  </div></main>
  <div className="bottom-nav">{[['dashboard','Главная',Home],['clients','Клиенты',Users],['payments','Оплаты',Coins],['visits','Визиты',CalendarDays]].map(([k,t,I])=><button onClick={()=>go(k)} className={page===k?'selected':''} key={k}><I size={22}/><span>{t}</span></button>)}<button className={NAV.slice(4).some(x=>x[0]===page)&&page!=='visits'?'selected':''} onClick={()=>setDrawer(true)}><Menu size={22}/><span>Ещё</span></button></div>
  {selectedClientRow&&clientDetail()}{modalNode}
  {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
 </div>
}
