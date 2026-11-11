// No invented balance or conversion rate: the provider and redemption rules are pending.
export function LoyaltyStatus({onCard=false}:{onCard?:boolean}){
 return <section className={onCard?'loyalty-status loyalty-status--card':'loyalty-status'} aria-label="Баллы по карте">
  <div><span>Накопленные баллы</span><strong>—</strong></div>
  <p>Расчёт доступен от 100 накопленных баллов.</p>
  <small>Баланс пока недоступен. Списание ещё не подключено.</small>
 </section>;
}
