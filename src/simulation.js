export function depthUnits(notional, unitValue, cap = 48) {
  if (!(notional > 0) || !(unitValue > 0)) return []
  const count = Math.ceil(notional / unitValue - 1e-9)
  const shown = Math.min(count, cap)
  return Array.from({length:shown}, (_, i) => ({
    notional: count > cap ? notional / shown : Math.min(unitValue, notional - i * unitValue),
    represented: count > cap ? count / shown : 1,
  }))
}
export function createLedger(initial = 100) {
  let available = initial, seq = 0, realized = 0
  const open = [], completed = [], positions = []
  return {
    get available() { return available },
    get realized() { return realized },
    open, completed, positions,
    deposit(amount) { if (Number.isFinite(amount) && amount > 0) available += amount },
    place(side, price, notional, marketId) {
      if (!(Number.isFinite(price) && price > 0 && price <= 100 && Number.isFinite(notional) && notional > 0 && notional <= available)) return null
      const order = {id:'O-' + ++seq,side,price,notional,quantity:notional / (price / 100),marketId,status:'open'}
      available -= notional; open.push(order); return order
    },
    cancel(id, status = 'cancelled') {
      const index = open.findIndex(o=>o.id===id); if(index < 0) return false
      const [order] = open.splice(index,1); available += order.notional
      completed.unshift({...order,status}); return true
    },
    fill(id, quantity, price) {
      const order = open.find(o=>o.id===id)
      if(!order || !Number.isFinite(quantity) || !(quantity>0) || !Number.isFinite(price) || price < 0 || price > order.price) return 0
      const size = Math.min(quantity,order.quantity), reserved = size * order.price / 100, cost = size * price / 100
      available += reserved - cost
      positions.push({id:'P-'+ ++seq,side:order.side,price,notional:cost,quantity:size,marketId:order.marketId,status:'held'})
      completed.unshift({...order,id:'F-'+seq,quantity:size,notional:cost,price,status:'filled'})
      order.quantity -= size; order.notional = order.quantity * order.price / 100
      if(order.quantity < 1e-8) open.splice(open.indexOf(order),1)
      return size
    },
    mark(market) {
      return positions.reduce((sum,p)=>{
        if(p.marketId!==market.marketId) return sum
        const bid=p.side==='UP'?market.bidUp:market.bidDown
        return bid == null ? sum : sum + p.quantity*(bid-p.price)/100
      },0)
    },
    close(id, price) {
      const index=positions.findIndex(p=>p.id===id)
      if(index<0 || !Number.isFinite(price) || !(price>=0 && price<=100)) return false
      const [position]=positions.splice(index,1)
      const proceeds=position.quantity*price/100
      available+=proceeds;realized+=proceeds-position.notional
      completed.unshift({...position,id:'C-'+ ++seq,price,notional:proceeds,status:'closed'})
      return true
    },
  }
}
