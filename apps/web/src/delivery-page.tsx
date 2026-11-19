import { FREE_COURIER_FROM } from './cart-summary.mjs';
import {money} from '../../../packages/presentation/store';
import {Icon} from '../../../packages/presentation/ui';
import {InformationHeader,InformationClosing} from '../../../packages/presentation/information-layout';
import './delivery-page.css';

export function DeliveryPage(){return <div className="delivery-page information-page" data-ds-id="page-delivery">
 
 <InformationHeader title="Условия доставки" plain kicker="" description="Самовывоз, курьерская доставка и отправка по России."/><div className="delivery-content">
 <section className="delivery-intro">
  <div><h2>Доставим ваш заказ удобным для вас способом</h2><p>Заберите продукцию в нашем сервисном центре в Санкт-Петербурге, оформите курьерскую доставку по городу или получите посылку CDEK в другом регионе России.</p><p>Здесь собраны адрес самовывоза, сроки подготовки заказа и условия доставки — чтобы вы могли спокойно выбрать подходящий вариант.</p></div>
  <img src="/images/information/delivery-v1.jpg" alt="Бережная упаковка заказа в крафтовую коробку у садового окна" width="1536" height="1024" fetchPriority="high"/>
 </section>
 <section className="delivery-section">
  <h2>Самовывоз в Санкт-Петербурге</h2>
  <div className="delivery-copy"><p>Вы можете бесплатно забрать заказ из нашего сервисного центра. Менеджер подтвердит его в течение 1 рабочего дня. Мы обрабатываем заказы с понедельника по пятницу, а после подтверждения резервируем товары для вас на 2 дня.</p>
   <div className="delivery-note"><h3>Адрес сервисного центра</h3><a href="/contacts/">г. Санкт-Петербург, наб. Обводного канала д.64, корп.2, лит.А, помещ. 17H, оф. 29/3 (2-ой этаж)</a></div>
  </div>
 </section>
 <section className="delivery-section">
  <h2>Курьером по Санкт-Петербургу</h2>
  <div className="delivery-copy"><p>Доставим заказ в течение 2 рабочих дней после подтверждения менеджером, если товары есть на складе. Доставка работает с понедельника по пятницу. Заказы, оформленные в пятницу, передаются курьеру начиная с понедельника следующей недели.</p><p>В течение 1 рабочего дня после оформления заказа менеджер позвонит по указанному вами номеру и согласует удобное время получения. В день доставки курьер свяжется с вами за 1 час до приезда и уточнит время прибытия.</p>
   <div className="delivery-rates"><div><h3>В пределах КАД</h3><p className="delivery-price">350 руб.</p><p>Зелёная зона. При заказе от {money(FREE_COURIER_FROM)} — бесплатно.</p></div><div><h3>За пределами КАД</h3><p className="delivery-price delivery-price--text">По тарифам CDEK</p><p>Синяя зона: Пушкин, Стрельна, Парголово, Колпино, Мурино, Бугры, Шушары, Кудрово.</p></div></div>
  </div>
 </section>
 <section className="delivery-section">
  <h2>CDEK по России</h2>
  <div className="delivery-copy"><p>Отправляем заказы в регионы России до пункта выдачи (ПВЗ) или по указанному вами адресу. Этот способ доставки доступен только по полной предоплате.</p><p>Обработка заказа занимает до 1 рабочего дня, с понедельника по пятницу. Отгрузка в курьерскую службу CDEK занимает 2 рабочих дня.</p><p>Стоимость и сроки доставки рассчитываются индивидуально при оформлении заказа. Они зависят от веса и габаритов посылки, стоимости товаров и адреса получения. Доставка оплачивается по тарифам перевозчика.</p><p>После передачи посылки на отправку вы получите SMS с номером экспресс-накладной. По нему можно следить за заказом на сайте CDEK.</p><a className="delivery-tracking" href="https://www.cdek.ru/ru/tracking" target="_blank" rel="noopener noreferrer">Отследить посылку в CDEK <Icon name="chevron" size={20}/></a></div>
 </section>
</div><InformationClosing>Поможем уточнить условия получения вашего заказа.</InformationClosing></div>;}
